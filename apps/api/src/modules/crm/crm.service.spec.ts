import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CrmService } from './crm.service';
import { AdmissionType, ProgramType } from '@calyvia/shared';

function makePrisma() {
  return {
    admission: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    patient: { findUnique: jest.fn(), update: jest.fn() },
    lead: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), update: jest.fn() },
    query: jest.fn(async () => ({ rows: [] })),
  } as any;
}

const dto = {
  patientId: 'pat-1',
  admissionType: AdmissionType.VOLUNTARY,
  programType: ProgramType.REHAB_30_DAYS,
  primaryDiagnosis: 'Alcohol dependence syndrome, severe',
  referringDoctor: 'Dr. Kevin Kiprotich',
};

describe('CrmService.processAdmission', () => {
  it('requires a primary diagnosis (live column is NOT NULL)', async () => {
    const prisma = makePrisma();
    const service = new CrmService(prisma);

    await expect(
      service.processAdmission({ ...dto, primaryDiagnosis: '   ' } as any, 'staff-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.admission.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown patient', async () => {
    const prisma = makePrisma();
    prisma.patient.findUnique.mockResolvedValue(null);
    const service = new CrmService(prisma);

    await expect(service.processAdmission(dto as any, 'staff-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects a second active admission for the same patient', async () => {
    const prisma = makePrisma();
    prisma.patient.findUnique.mockResolvedValue({ id: 'pat-1' });
    prisma.admission.findMany.mockResolvedValue([{ id: 'adm-old', admissionNumber: 'ADM-2026-1' }]);
    const service = new CrmService(prisma);

    await expect(service.processAdmission(dto as any, 'staff-1')).rejects.toThrow(
      'already has an active admission',
    );
  });

  it('writes only real admissions columns and uses the acting user as admitting staff', async () => {
    const prisma = makePrisma();
    prisma.patient.findUnique.mockResolvedValue({ id: 'pat-1' });
    prisma.admission.findMany.mockResolvedValue([]);
    prisma.admission.create.mockResolvedValue({ id: 'adm-1', admissionNumber: 'ADM-2026-4242' });
    prisma.patient.update.mockResolvedValue({});
    const service = new CrmService(prisma);

    const result = await service.processAdmission(dto as any, 'staff-99');

    const data = prisma.admission.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      patientId: 'pat-1',
      primaryDiagnosis: 'Alcohol dependence syndrome, severe',
      referringDoctor: 'Dr. Kevin Kiprotich',
      admittingStaffId: 'staff-99',
      isActive: true,
    });
    expect(JSON.stringify(data)).not.toContain('admitting_doctor_name');
    expect(JSON.stringify(data)).not.toContain('primaryCounsellorName');
    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'pat-1' },
      data: { status: 'ADMITTED_REHAB' },
    });
    expect((result as any).id).toBe('adm-1');
  });

  it('maps DETOX_ONLY onto the ADMITTED_DETOX patient status', async () => {
    const prisma = makePrisma();
    prisma.patient.findUnique.mockResolvedValue({ id: 'pat-1' });
    prisma.admission.findMany.mockResolvedValue([]);
    prisma.admission.create.mockResolvedValue({ id: 'adm-2' });
    prisma.patient.update.mockResolvedValue({});
    const service = new CrmService(prisma);

    await service.processAdmission(
      { ...dto, programType: ProgramType.DETOX_ONLY } as any,
      'staff-99',
    );

    expect(prisma.patient.update).toHaveBeenCalledWith({
      where: { id: 'pat-1' },
      data: { status: 'ADMITTED_DETOX' },
    });
  });

  it('propagates database errors instead of fabricating a success payload', async () => {
    const prisma = makePrisma();
    prisma.patient.findUnique.mockResolvedValue({ id: 'pat-1' });
    prisma.admission.findMany.mockResolvedValue([]);
    prisma.admission.create.mockRejectedValue(new Error('column error'));
    const service = new CrmService(prisma);

    await expect(service.processAdmission(dto as any, 'staff-1')).rejects.toThrow(
      'column error',
    );
  });
});

describe('CrmService.getAdmissions', () => {
  it('joins patient details onto each admission', async () => {
    const prisma = makePrisma();
    prisma.query.mockResolvedValue({
      rows: [
        {
          id: 'adm-1',
          admission_number: 'ADM-2026-4242',
          patient_id: 'pat-1',
          admission_date: '2026-11-20T00:00:00Z',
          admission_type: 'VOLUNTARY',
          program_type: 'REHAB_30_DAYS',
          primary_diagnosis: 'Alcohol dependence',
          referring_doctor: null,
          admitting_staff_id: 'staff-99',
          is_active: true,
          discharge_date: null,
          created_at: '2026-11-20T00:00:00Z',
          first_name: 'Hannah',
          last_name: 'Njoki',
          phone: '+254700000000',
          patient_status: 'ADMITTED_REHAB',
        },
      ],
    });
    const service = new CrmService(prisma);

    const rows = await service.getAdmissions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      admissionNumber: 'ADM-2026-4242',
      isActive: true,
      patient: { firstName: 'Hannah', lastName: 'Njoki', status: 'ADMITTED_REHAB' },
    });
  });
});
