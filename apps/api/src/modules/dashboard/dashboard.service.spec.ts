import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../database/prisma.service';

describe('DashboardService (Executive KPIs & Census)', () => {
  let service: DashboardService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      bed: {
        count: jest.fn().mockImplementation((args?: any) => {
          if (args?.where?.status === 'OCCUPIED') return Promise.resolve(28);
          return Promise.resolve(32);
        }),
      },
      bedAllocation: {
        count: jest.fn().mockResolvedValue(6),
      },
      admission: {
        count: jest.fn().mockResolvedValue(10),
      },
      detoxEpisode: {
        count: jest.fn().mockResolvedValue(6),
      },
      lead: {
        count: jest.fn().mockResolvedValue(5),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      payment: {
        findMany: jest.fn().mockResolvedValue([
          { amountPaid: 2611200, paymentMethod: 'MPESA_STK', createdAt: new Date() },
          { amountPaid: 1228800, paymentMethod: 'BANK_TRANSFER', createdAt: new Date() },
        ]),
      },
      staffTask: {
        count: jest.fn().mockResolvedValue(0),
      },
      user: {
        count: jest.fn().mockResolvedValue(6),
      },
      incidentReport: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate executive metrics and census ratios dynamically', async () => {
    const metrics = await service.getExecutiveMetrics();

    expect(metrics).toBeDefined();
    expect(metrics.facility.name).toBe('Calyvia Wellness Center');
    expect(metrics.facility.status).toBeNull();
    expect(metrics.census.inpatientMaleOccupancy).toBeNull();
    expect(metrics.clinical.criticalVitalsAlerts).toBeNull();

    // Census assertions based on mock database state
    expect(metrics.census.totalBeds).toBe(32);
    expect(metrics.census.occupiedBeds).toBe(28);
    expect(metrics.census.availableBeds).toBe(4);
    expect(metrics.census.occupancyRatePercentage).toBe(87.5);

    // Financial calculations
    expect(metrics.financials.currency).toBe('KES');
    expect(metrics.financials.mtdRevenueCollected).toBe(3840000.0);
    expect(metrics.financials.mpesaVolumePercentage + metrics.financials.bankTransferPercentage).toBeCloseTo(100.0);
  });

  it('should return clean zeroes when database is completely empty', async () => {
    const emptyPrisma = {
      bed: { count: jest.fn().mockResolvedValue(0) },
      bedAllocation: { count: jest.fn().mockResolvedValue(0) },
      admission: { count: jest.fn().mockResolvedValue(0) },
      detoxEpisode: { count: jest.fn().mockResolvedValue(0) },
      lead: { count: jest.fn().mockResolvedValue(0) },
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      staffTask: { count: jest.fn().mockResolvedValue(0) },
      user: { count: jest.fn().mockResolvedValue(0) },
      incidentReport: { count: jest.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: emptyPrisma },
      ],
    }).compile();

    const emptyService = module.get<DashboardService>(DashboardService);
    const metrics = await emptyService.getExecutiveMetrics();

    expect(metrics.census.totalBeds).toBe(0);
    expect(metrics.census.occupiedBeds).toBe(0);
    expect(metrics.census.availableBeds).toBe(0);
    expect(metrics.census.occupancyRatePercentage).toBe(0);
    expect(metrics.financials.mtdRevenueCollected).toBe(0);
    expect(metrics.clinical.therapySessionsToday).toBe(0);
  });
});
