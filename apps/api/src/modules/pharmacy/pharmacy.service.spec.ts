import { Test, TestingModule } from '@nestjs/testing';
import { PharmacyService } from './pharmacy.service';
import { PrismaService } from '../../database/prisma.service';

describe('PharmacyService patient medications', () => {
  it('joins prescriptions through admissions instead of using a non-existent patient_id', async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{ prescriptionId: 'rx-1', brandName: 'Paracetamol', dosage: '500mg' }],
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PharmacyService,
        { provide: PrismaService, useValue: { pool: { query } } },
      ],
    }).compile();
    const service = module.get<PharmacyService>(PharmacyService);

    const result = await service.getPatientMedications('patient-1');

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('JOIN public.admissions a ON a.id = pr.admission_id');
    expect(sql).toContain('WHERE a.patient_id = $1');
    expect(params).toEqual(['patient-1']);
    expect(result).toEqual([{ prescriptionId: 'rx-1', brandName: 'Paracetamol', dosage: '500mg' }]);
  });
});
