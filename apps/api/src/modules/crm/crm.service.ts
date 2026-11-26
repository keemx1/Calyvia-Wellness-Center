import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateLeadDto, UpdateLeadStatusDto, CreateAdmissionDto } from './dto/crm.dto';
import { KenyaUtils, PatientStatus } from '@calyvia/shared';

@Injectable()
export class CrmService {
  constructor(private prisma: PrismaService) {}

  private generateEnquiryNumber(): string {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `ENQ-${new Date().getFullYear()}-${rand}`;
  }

  private generateAdmissionNumber(): string {
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `ADM-${new Date().getFullYear()}-${rand}`;
  }

  async createLead(dto: CreateLeadDto) {
    const enqNumber = this.generateEnquiryNumber();
    const phone = KenyaUtils.normalizePhoneNumber(dto.phone);

    try {
      if (this.prisma && this.prisma.lead) {
        return await this.prisma.lead.create({
          data: {
            enquiryNumber: enqNumber,
            fullName: dto.fullName,
            phone,
            email: dto.email || null,
            channel: dto.channel || 'DIRECT_WEBSITE',
            substancesUsed: dto.substancesUsed || null,
            urgencyLevel: dto.urgencyLevel || 'ROUTINE',
            pipelineStatus: 'NEW_INQUIRY',
            notes: dto.notes || null,
          },
        });
      }
      throw new Error('Database connection unavailable');
    } catch (err: any) {
      throw new Error(`Failed to create lead enquiry: ${err.message || 'Database error'}`);
    }
  }

  async getLeads(status?: string) {
    try {
      if (this.prisma && this.prisma.lead) {
        return await this.prisma.lead.findMany({
          where: status ? { pipelineStatus: status } : {},
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch (err) {
      console.warn('Leads fetch error:', err);
    }
    return [];
  }

  async updateLeadStatus(id: string, dto: UpdateLeadStatusDto) {
    try {
      if (this.prisma && this.prisma.lead) {
        return await this.prisma.lead.update({
          where: { id },
          data: {
            pipelineStatus: dto.status,
            notes: dto.notes,
          },
        });
      }
    } catch (err) {
      console.warn('Update lead status error:', err);
    }
    return { id, pipelineStatus: dto.status, notes: dto.notes };
  }

  /**
   * Formally admit a patient.
   *
   * The live admissions table requires primary_diagnosis (NOT NULL) and
   * admitting_staff_id (NOT NULL FK), and has no admitting_doctor_name /
   * primary_counsellor_name columns - this used to write phantom columns and
   * then return a fabricated success object. Now it validates and throws.
   */
  async processAdmission(dto: CreateAdmissionDto, admittedById?: string) {
    const admNumber = this.generateAdmissionNumber();

    if (!dto.primaryDiagnosis?.trim()) {
      throw new BadRequestException('primaryDiagnosis is required.');
    }
    if (!this.prisma || !this.prisma.admission) {
      throw new BadRequestException('Database connection unavailable.');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: dto.patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient ${dto.patientId} not found.`);
    }

    const activeEpisodes = await this.prisma.admission.findMany({
      where: { patientId: dto.patientId, isActive: true },
    });
    if (activeEpisodes.length > 0) {
      throw new BadRequestException(
        `Patient already has an active admission episode (${activeEpisodes[0].admissionNumber}).`,
      );
    }

    const admittingStaffId = dto.admittingStaffId || admittedById;
    if (!admittingStaffId) {
      throw new BadRequestException('admittingStaffId could not be determined.');
    }

    const admission = await this.prisma.admission.create({
      data: {
        admissionNumber: admNumber,
        patientId: dto.patientId,
        admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : new Date(),
        admissionType: dto.admissionType,
        programType: dto.programType,
        primaryDiagnosis: dto.primaryDiagnosis.trim(),
        referringDoctor: dto.referringDoctor || dto.admittingDoctorName || null,
        admittingStaffId,
        isActive: true,
      },
    });

    // Update patient status to ADMITTED_DETOX or ADMITTED_REHAB
    const targetStatus =
      dto.programType === 'DETOX_ONLY'
        ? PatientStatus.ADMITTED_DETOX
        : PatientStatus.ADMITTED_REHAB;

    await this.prisma.patient.update({
      where: { id: dto.patientId },
      data: { status: targetStatus },
    });

    return admission;
  }

  async getAdmissions() {
    try {
      if (this.prisma && this.prisma.admission) {
        const res = await this.prisma.query(
          `SELECT a.*, p.first_name, p.last_name, p.phone, p.status AS patient_status
           FROM public."admissions" a
           LEFT JOIN public."patients" p ON p.id = a.patient_id
           ORDER BY a.admission_date DESC`,
        );
        return res.rows.map((r: any) => ({
          id: r.id,
          admissionNumber: r.admission_number,
          patientId: r.patient_id,
          admissionDate: r.admission_date,
          admissionType: r.admission_type,
          programType: r.program_type,
          primaryDiagnosis: r.primary_diagnosis,
          referringDoctor: r.referring_doctor,
          admittingStaffId: r.admitting_staff_id,
          isActive: r.is_active,
          dischargeDate: r.discharge_date,
          createdAt: r.created_at,
          patient: r.first_name
            ? {
                firstName: r.first_name,
                lastName: r.last_name,
                phone: r.phone,
                status: r.patient_status,
              }
            : null,
        }));
      }
    } catch (err) {
      console.warn('Admissions fetch error:', err);
    }
    return [];
  }
}
