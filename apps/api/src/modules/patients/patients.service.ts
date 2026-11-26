import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { CommunicationService } from '../communication/communication.service';
import {
  CreatePatientDto,
  UpdatePatientDto,
  UploadPatientPhotoDto,
} from './dto/patient.dto';
import {
  CommunicationChannel,
  KenyaUtils,
  PatientStatus,
  UserRole,
} from '@calyvia/shared';

/** Kept in step with SystemAdminService.getFacilityConfig(). */
const FACILITY_NAME = 'Calyvia Wellness Center';
const FACILITY_PHONE = '+254700534306';
const PHOTO_BUCKET = 'patient-documents';
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ADMIN_NOTIFY_ROLES = [UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.MEDICAL_DIRECTOR];
const MAX_ADMIN_RECIPIENTS = 3;

@Injectable()
export class PatientsService {
  private readonly logger = new Logger(PatientsService.name);

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private communication: CommunicationService,
  ) {}

  private generateRegistrationNumber(): string {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `CAL-${year}-${rand}`;
  }

  private normalizePhone(value?: string | null): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      return KenyaUtils.normalizePhoneNumber(raw);
    } catch {
      return raw;
    }
  }

  async create(dto: CreatePatientDto) {
    const regNumber = this.generateRegistrationNumber();
    const normalizedPhone = this.normalizePhone(dto.phone);

    const nationalIdEncrypted = dto.nationalIdNumber
      ? this.crypto.encrypt(dto.nationalIdNumber)
      : null;
    const knownAllergiesEnc = dto.knownAllergies
      ? this.crypto.encrypt(dto.knownAllergies)
      : null;
    const substanceHistoryEnc = dto.substanceHistory
      ? this.crypto.encrypt(dto.substanceHistory)
      : null;

    try {
      if (this.prisma && this.prisma.patient) {
        const patient = await this.prisma.patient.create({
          data: {
            registrationNumber: regNumber,
            firstName: dto.firstName,
            lastName: dto.lastName,
            preferredName: dto.preferredName || null,
            nationalIdEncrypted,
            dateOfBirth: new Date(dto.dateOfBirth),
            gender: dto.gender,
            phone: normalizedPhone,
            email: dto.email || null,
            county: dto.county,
            residentialAddress: dto.residentialAddress,
            bloodGroup: dto.bloodGroup || null,
            knownAllergiesEnc,
            substanceHistoryEnc,
            status: PatientStatus.ENQUIRY,
          },
        });

        // Guardian details live in the existing emergency_contacts table with a
        // GUARDIAN relationship — no schema migration is required, and the
        // patient dashboard already receives this row via findOne().
        const guardian = await this.saveGuardian(patient.id, dto);
        const guardianMessages = await this.sendGuardianWelcome(patient, dto);
        const adminMessages = await this.sendAdministratorNotification(patient, dto);

        return {
          ...this.sanitizePatient(patient),
          guardian,
          welcomeNotifications: [...guardianMessages, ...adminMessages],
        };
      }
      throw new Error('Database connection unavailable');
    } catch (err: any) {
      throw new Error(`Failed to register patient: ${err.message || 'Database error'}`);
    }
  }

  /** Returns null when no guardian details were supplied. Never fails registration. */
  private async saveGuardian(patientId: string, dto: CreatePatientDto) {
    const hasGuardian = [dto.guardianName, dto.guardianPhone, dto.guardianWhatsApp, dto.guardianEmail]
      .some((value) => String(value || '').trim());
    if (!hasGuardian || !this.prisma?.emergencyContact?.create) return null;

    const sms = this.normalizePhone(dto.guardianPhone);
    const whatsapp = this.normalizePhone(dto.guardianWhatsApp);
    const guardian = {
      patientId,
      fullName: String(dto.guardianName || '').trim() || 'Guardian',
      relationship: 'GUARDIAN',
      phone: sms || whatsapp || this.normalizePhone(dto.phone),
      alternativePhone: whatsapp || null,
      email: dto.guardianEmail || null,
      isPrimaryGuarantor: true,
      consentToContact: true,
      notes: 'Parent/guardian added at registration. Receives welcome, admission and billing updates.',
    };

    try {
      return await this.prisma.emergencyContact.create({ data: guardian });
    } catch (err: any) {
      this.logger.warn(`Guardian contact could not be saved for ${patientId}: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Welcome messages are fire-and-forget: a gateway failure must never undo a
   * successful patient registration. Each attempt is reported back to the UI.
   */
  private async sendGuardianWelcome(patient: any, dto: CreatePatientDto) {
    const calls: Array<{ channel: CommunicationChannel; recipient: string }> = [];
    const sms = this.normalizePhone(dto.guardianPhone);
    const whatsapp = this.normalizePhone(dto.guardianWhatsApp);
    if (sms) calls.push({ channel: CommunicationChannel.SMS, recipient: sms });
    if (whatsapp) calls.push({ channel: CommunicationChannel.WHATSAPP, recipient: whatsapp });

    if (!calls.length || !this.communication?.sendMessage) return [];

    const variables = {
      caregiver_name: String(dto.guardianName || '').trim() || 'Guardian',
      patient_name: patient.firstName || 'your client',
      facility: FACILITY_NAME,
      phone: FACILITY_PHONE,
    };

    const results: any[] = [];
    for (const call of calls) {
      try {
        const sent = await this.communication.sendMessage({
          recipient: call.recipient,
          channel: call.channel,
          recipientType: 'FAMILY',
          templateKey: 'GUARDIAN_WELCOME',
          variables,
        });
        results.push({
          audience: 'GUARDIAN',
          channel: call.channel,
          recipient: call.recipient,
          status: sent?.status || 'SENT',
          provider: sent?.provider || null,
        });
      } catch (err: any) {
        const message = err?.message || 'Gateway error';
        this.logger.warn(`Guardian welcome ${call.channel} failed for ${call.recipient}: ${message}`);
        results.push({
          audience: 'GUARDIAN',
          channel: call.channel,
          recipient: call.recipient,
          status: 'FAILED',
          error: message,
        });
      }
    }
    return results;
  }

  /** Active facility administrators with a usable phone number. */
  private async administratorRecipients(): Promise<string[]> {
    try {
      if (!this.prisma?.user?.findMany) return [];
      const users = await this.prisma.user.findMany({
        where: { role: { in: ADMIN_NOTIFY_ROLES }, isActive: true },
        take: 10,
      });
      const unique = new Set<string>();
      for (const user of users ?? []) {
        const phone = this.normalizePhone(user.phone);
        if (/^\+\d{9,15}$/.test(phone)) unique.add(phone);
        if (unique.size >= MAX_ADMIN_RECIPIENTS) break;
      }
      if (!unique.size) {
        this.logger.warn('No administrator phone numbers found; new-patient alerts were not sent.');
      }
      return [...unique];
    } catch (err: any) {
      this.logger.warn(`Administrator lookup failed: ${err?.message || err}`);
      return [];
    }
  }

  /** Every new registration is reported to administrators on SMS and WhatsApp. */
  private async sendAdministratorNotification(patient: any, dto: CreatePatientDto) {
    const recipients = await this.administratorRecipients();
    if (!recipients.length || !this.communication?.sendMessage) return [];

    const variables = {
      patient_name: patient.firstName || 'a new client',
      guardian_name: String(dto.guardianName || '').trim() || 'Not provided',
      facility: FACILITY_NAME,
      phone: FACILITY_PHONE,
      date: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    };

    const results: any[] = [];
    for (const recipient of recipients) {
      for (const channel of [CommunicationChannel.SMS, CommunicationChannel.WHATSAPP]) {
        try {
          const sent = await this.communication.sendMessage({
            recipient,
            channel,
            recipientType: 'STAFF',
            templateKey: 'ADMIN_NEW_PATIENT',
            variables,
          });
          results.push({
            audience: 'ADMIN',
            channel,
            recipient,
            status: sent?.status || 'SENT',
            provider: sent?.provider || null,
          });
        } catch (err: any) {
          const message = err?.message || 'Gateway error';
          this.logger.warn(`Admin notification ${channel} failed for ${recipient}: ${message}`);
          results.push({
            audience: 'ADMIN',
            channel,
            recipient,
            status: 'FAILED',
            error: message,
          });
        }
      }
    }
    return results;
  }

  async findAll(query?: { search?: string; status?: string; limit?: number }) {
    try {
      if (this.prisma && this.prisma.patient) {
        const patients = await this.prisma.patient.findMany({
          where: {
            ...(query?.status ? { status: query.status as any } : {}),
            isArchived: false,
          },
          take: query?.limit || 50,
          orderBy: { createdAt: 'desc' },
        });
        return patients.map((p) => this.sanitizePatient(p));
      }
    } catch (err) {
      console.warn('Patients fetch error:', err);
    }
    return [];
  }

  async findOne(id: string) {
    if (this.prisma && this.prisma.patient) {
      const patient = await this.prisma.patient.findUnique({
        where: { id, isArchived: false },
        include: {
          emergencyContacts: true,
          admissions: true,
          bedAllocations: { include: { bed: { include: { room: true } } } },
        },
      });
      if (patient) return this.sanitizePatient(patient);
    }
    throw new NotFoundException(`Patient record not found: ${id}`);
  }

  async update(id: string, dto: UpdatePatientDto) {
    try {
      if (this.prisma && this.prisma.patient) {
        const updated = await this.prisma.patient.update({
          where: { id },
          data: {
            preferredName: dto.preferredName,
            phone: dto.phone ? KenyaUtils.normalizePhoneNumber(dto.phone) : undefined,
            residentialAddress: dto.residentialAddress,
            status: dto.status,
          },
        });
        return this.sanitizePatient(updated);
      }
    } catch {
      // Fallback
    }
    return { id, ...dto, updatedAt: new Date().toISOString() };
  }

  /**
   * "Delete" archives the patient rather than physically removing the row.
   * Admissions, invoices and aftercare plans have RESTRICT foreign keys, and
   * clinical records must be retained, so the patient is hidden from the
   * active registry via the existing is_archived flag.
   */
  async deletePatient(id: string) {
    const patient = await this.ensurePatient(id);
    if (patient.isArchived) {
      throw new BadRequestException('This patient has already been deleted.');
    }

    const activeAdmissions = this.prisma.admission?.findMany
      ? await this.prisma.admission.findMany({
          where: { patientId: id, isActive: true },
          take: 1,
        })
      : [];
    if (activeAdmissions.length) {
      throw new BadRequestException(
        'Cannot delete a patient with an active admission. Discharge the patient first.',
      );
    }

    const archived = await this.prisma.patient.update({
      where: { id },
      data: { isArchived: true },
    });
    const patientName = [patient.firstName, patient.lastName].filter(Boolean).join(' ');
    return {
      success: true,
      archived: true,
      id: archived?.id || id,
      patientName,
      message: `${patientName || 'Patient'} was removed from the active registry. Clinical and billing records were retained.`,
    };
  }

  private async ensurePatient(id: string) {
    if (!this.prisma?.patient?.findUnique) {
      throw new BadRequestException('Patient repository is unavailable.');
    }
    const patient = await this.prisma.patient.findUnique({ where: { id } });
    if (!patient) throw new NotFoundException(`Patient record not found: ${id}`);
    return patient;
  }

  /** Patient passport photos stay in the private Supabase bucket; only signed URLs leave the API. */
  async listPatientPhotos(id: string) {
    await this.ensurePatient(id);
    const client = this.prisma?.client;
    if (!client) return [];

    const { data, error } = await client.storage
      .from(PHOTO_BUCKET)
      .list(id, { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
    if (error) {
      throw new BadRequestException(`Could not list patient photos: ${error.message}`);
    }

    return Promise.all(
      (data || [])
        .filter((object) => object.name && !object.name.startsWith('.'))
        .map(async (object) => {
          const path = `${id}/${object.name}`;
          const { data: signed } = await client.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(path, 3600);
          return {
            path,
            name: object.name,
            size: (object as any).metadata?.size ?? null,
            createdAt: object.created_at ?? null,
            url: signed?.signedUrl ?? null,
          };
        }),
    );
  }

  async uploadPatientPhoto(id: string, dto: UploadPatientPhotoDto) {
    await this.ensurePatient(id);
    const allowed: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
    };
    const extension = allowed[String(dto.mimeType || '').toLowerCase()];
    if (!extension) {
      throw new BadRequestException('Only JPG and PNG patient photos are supported.');
    }

    const rawBase64 = String(dto.dataBase64 || '');
    const base64 = rawBase64.includes(',') ? rawBase64.split(',')[1] : rawBase64;
    const bytes = Buffer.from(base64 || '', 'base64');
    if (!bytes.length) throw new BadRequestException('The uploaded photo is empty.');
    if (bytes.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException('Patient photos must be 5 MB or smaller.');
    }

    const client = this.prisma?.client;
    if (!client) throw new BadRequestException('Patient photo storage is unavailable.');

    const safeName = String(dto.fileName || `photo.${extension}`)
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .slice(-80);
    const path = `${id}/${Date.now()}-${safeName}`;
    const { error } = await client.storage.from(PHOTO_BUCKET).upload(path, bytes, {
      contentType: dto.mimeType,
      upsert: false,
    });
    if (error) throw new BadRequestException(`Could not store patient photo: ${error.message}`);

    const { data: signed } = await client.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, 3600);
    return { path, name: safeName, size: bytes.length, url: signed?.signedUrl ?? null };
  }

  private sanitizePatient(patient: any) {
    return {
      ...patient,
      knownAllergies: this.crypto.decrypt(patient.knownAllergiesEnc),
      substanceHistory: this.crypto.decrypt(patient.substanceHistoryEnc),
      nationalIdDecrypted: patient.nationalIdEncrypted
        ? this.crypto.decrypt(patient.nationalIdEncrypted)
        : null,
      knownAllergiesEnc: undefined,
      substanceHistoryEnc: undefined,
      nationalIdEncrypted: undefined,
    };
  }
}
