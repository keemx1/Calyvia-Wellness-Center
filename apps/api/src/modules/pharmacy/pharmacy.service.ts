import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CreatePrescriptionDto {
  patientId: string;
  doctorName: string;
  medicationId: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
}

export interface AdministerMedicationDto {
  prescriptionId: string;
  administeredBy: string;
  status: string; // GIVEN, REFUSED, WITHHELD
  notes?: string;
}

@Injectable()
export class PharmacyService {
  constructor(private prisma: PrismaService) {}

  async getMedications() {
    try {
      if (this.prisma && this.prisma.medication) {
        return await this.prisma.medication.findMany({
          orderBy: { brandName: 'asc' },
        });
      }
    } catch (err) {
      console.warn('Medications fetch error:', err);
    }
    return [];
  }

  /**
   * Patient-scoped medication list for the patient dashboard. Prescriptions
   * hang off admissions (not patients), so join through admissions rather than
   * inventing a patient_id column that the schema does not have.
   */
  async getPatientMedications(patientId: string) {
    if (!patientId) return [];
    try {
      const pool = (this.prisma as any)?.pool;
      if (!pool?.query) return [];
      const { rows } = await pool.query(
        `SELECT pr.id AS "prescriptionId", pr.prescribed_date AS "prescribedDate",
                pr.status, pr.diagnosis, pi.dosage, pi.route, pi.frequency,
                pi.duration_days AS "durationDays", pi.dispensed_quantity AS "dispensedQuantity",
                pi.instructions, m.brand_name AS "brandName", m.generic_name AS "genericName",
                m.strength, m.dosage_form AS "dosageForm"
         FROM public.prescriptions pr
         JOIN public.admissions a ON a.id = pr.admission_id
         LEFT JOIN public.prescription_items pi ON pi.prescription_id = pr.id
         LEFT JOIN public.medications m ON m.id = pi.medication_id
         WHERE a.patient_id = $1
         ORDER BY pr.prescribed_date DESC
         LIMIT 100`,
        [patientId],
      );
      return rows || [];
    } catch (err: any) {
      console.warn('Patient medications fetch error:', err?.message || err);
      return [];
    }
  }

  async createPrescription(dto: CreatePrescriptionDto) {
    if (!dto.patientId || !dto.doctorName || !dto.medicationId) {
      throw new BadRequestException('Patient ID, doctor name, and medication ID are mandatory.');
    }

    try {
      if (this.prisma && this.prisma.prescription) {
        return await this.prisma.prescription.create({
          data: {
            patientId: dto.patientId,
            doctorName: dto.doctorName,
            status: 'ACTIVE',
            medicationId: dto.medicationId,
            dosage: dto.dosage,
            frequency: dto.frequency,
            durationDays: dto.durationDays,
            instructions: dto.instructions || null,
          },
        });
      }
      throw new Error('Database connection unavailable');
    } catch (err: any) {
      throw new BadRequestException(`Failed to create prescription: ${err.message || 'Database error'}`);
    }
  }

  async administerMedication(dto: AdministerMedicationDto) {
    if (!dto.prescriptionId || !dto.administeredBy || !dto.status) {
      throw new BadRequestException('Prescription ID, administered by, and status are mandatory.');
    }

    try {
      if (this.prisma && this.prisma.medicationAdministration) {
        return await this.prisma.medicationAdministration.create({
          data: {
            prescriptionId: dto.prescriptionId,
            administeredBy: dto.administeredBy,
            status: dto.status,
            notes: dto.notes || null,
          },
        });
      }
      throw new Error('Database connection unavailable');
    } catch (err: any) {
      throw new BadRequestException(`Failed to administer medication: ${err.message || 'Database error'}`);
    }
  }
}
