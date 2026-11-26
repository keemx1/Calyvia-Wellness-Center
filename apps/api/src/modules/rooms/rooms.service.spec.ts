import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RoomsService, AllocateBedDto, TransferBedDto, CreateRoomDto } from './rooms.service';

function makePrisma() {
  const tx = {
    bedAllocation: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    bed: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  const prisma: any = {
    query: jest.fn(async () => ({ rows: [] })),
    room: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    bed: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    bedAllocation: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    admission: { findUnique: jest.fn(), findMany: jest.fn() },
    patient: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
  return prisma;
}

const validRoom: CreateRoomDto = {
  roomNumber: 'R-101',
  roomName: 'Horizon Room 1',
  roomType: 'INPATIENT_MALE',
  wing: 'Horizon Wing',
  floor: 'First',
};

describe('RoomsService', () => {
  describe('createRoom', () => {
    it('rejects an invalid room type against the RoomType enum', async () => {
      const prisma = makePrisma();
      const service = new RoomsService(prisma);

      await expect(service.createRoom({ ...validRoom, roomType: 'CUPBOARD' })).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.room.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate room number', async () => {
      const prisma = makePrisma();
      prisma.room.findUnique.mockResolvedValue({ id: 'existing' });
      const service = new RoomsService(prisma);

      await expect(service.createRoom(validRoom)).rejects.toThrow('already exists');
      expect(prisma.room.create).not.toHaveBeenCalled();
    });

    it('creates a room with schema-correct columns', async () => {
      const prisma = makePrisma();
      prisma.room.findUnique.mockResolvedValue(null);
      prisma.room.create.mockResolvedValue({ id: 'room-1' });
      const service = new RoomsService(prisma);

      const room = await service.createRoom(validRoom);
      expect(prisma.room.create).toHaveBeenCalledWith({
        data: {
          roomNumber: 'R-101',
          roomName: 'Horizon Room 1',
          roomType: 'INPATIENT_MALE',
          wing: 'Horizon Wing',
          floor: 'First',
        },
      });
      expect((room as any).beds).toEqual([]);
    });
  });

  describe('createBed', () => {
    it('fails when the room does not exist', async () => {
      const prisma = makePrisma();
      prisma.room.findUnique.mockResolvedValue(null);
      const service = new RoomsService(prisma);

      await expect(service.createBed('missing-room', { bedNumber: 'B1' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a duplicate bed number inside the room', async () => {
      const prisma = makePrisma();
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', roomNumber: 'R-101' });
      prisma.bed.findMany.mockResolvedValue([{ id: 'bed-existing' }]);
      const service = new RoomsService(prisma);

      await expect(service.createBed('room-1', { bedNumber: 'B1' })).rejects.toThrow(
        'already exists',
      );
      expect(prisma.bed.create).not.toHaveBeenCalled();
    });

    it('defaults the daily rate to 5000 when not provided', async () => {
      const prisma = makePrisma();
      prisma.room.findUnique.mockResolvedValue({ id: 'room-1', roomNumber: 'R-101' });
      prisma.bed.findMany.mockResolvedValue([]);
      prisma.bed.create.mockResolvedValue({ id: 'bed-1' });
      const service = new RoomsService(prisma);

      await service.createBed('room-1', { bedNumber: 'B1' });
      expect(prisma.bed.create).toHaveBeenCalledWith({
        data: { roomId: 'room-1', bedNumber: 'B1', dailyRate: 5000 },
      });
    });
  });

  describe('allocateBed', () => {
    const dto: AllocateBedDto = { bedId: 'bed-1', admissionId: 'adm-1' };

    it('requires both bed and admission', async () => {
      const service = new RoomsService(makePrisma());
      await expect(service.allocateBed({ bedId: 'bed-1' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown admission', async () => {
      const prisma = makePrisma();
      prisma.admission.findUnique.mockResolvedValue(null);
      const service = new RoomsService(prisma);

      await expect(service.allocateBed(dto)).rejects.toThrow(NotFoundException);
      expect(prisma.bed.findUnique).not.toHaveBeenCalled();
    });

    it('rejects a closed admission', async () => {
      const prisma = makePrisma();
      prisma.admission.findUnique.mockResolvedValue({ id: 'adm-1', isActive: false });
      const service = new RoomsService(prisma);

      await expect(service.allocateBed(dto)).rejects.toThrow('Admission episode is closed');
    });

    it('rejects a bed that is not AVAILABLE', async () => {
      const prisma = makePrisma();
      prisma.admission.findUnique.mockResolvedValue({ id: 'adm-1', isActive: true });
      prisma.bed.findUnique.mockResolvedValue({
        id: 'bed-1',
        bedNumber: 'B1',
        status: 'OCCUPIED',
        isActive: true,
      });
      const service = new RoomsService(prisma);

      await expect(service.allocateBed(dto)).rejects.toThrow('not available');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('writes only real bed_allocations columns (no phantom patient_id)', async () => {
      const prisma = makePrisma();
      prisma.admission.findUnique.mockResolvedValue({ id: 'adm-1', isActive: true });
      prisma.bed.findUnique.mockResolvedValue({
        id: 'bed-1',
        bedNumber: 'B1',
        status: 'AVAILABLE',
        isActive: true,
      });
      prisma.bedAllocation.findMany.mockResolvedValue([]);
      prisma.__tx.bedAllocation.create.mockResolvedValue({ id: 'alloc-1' });
      prisma.__tx.bed.update.mockResolvedValue({});
      const service = new RoomsService(prisma);

      const result = await service.allocateBed({ ...dto, patientId: 'ignored-legacy-field' });

      const createArgs = prisma.__tx.bedAllocation.create.mock.calls[0][0];
      expect(createArgs.data).toEqual({
        bedId: 'bed-1',
        admissionId: 'adm-1',
        isActive: true,
      });
      expect(JSON.stringify(createArgs)).not.toContain('patientId');
      expect(prisma.__tx.bed.update).toHaveBeenCalledWith({
        where: { id: 'bed-1' },
        data: { status: 'OCCUPIED' },
      });
      expect(result).toEqual({ id: 'alloc-1' });
    });
  });

  describe('transferBed', () => {
    const dto: TransferBedDto = {
      currentAllocationId: 'alloc-1',
      newBedId: 'bed-2',
      transferReason: 'Step-down to inpatient',
    };

    it('requires a transfer reason', async () => {
      const service = new RoomsService(makePrisma());
      await expect(service.transferBed({ ...dto, transferReason: '  ' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('closes the old allocation with released_at (not a phantom end_date)', async () => {
      const prisma = makePrisma();
      prisma.__tx.bedAllocation.findUnique.mockResolvedValue({
        id: 'alloc-1',
        bedId: 'bed-1',
        admissionId: 'adm-1',
        isActive: true,
      });
      prisma.__tx.bed.findUnique.mockResolvedValue({
        id: 'bed-2',
        bedNumber: 'B2',
        status: 'AVAILABLE',
        isActive: true,
      });
      prisma.__tx.bedAllocation.update.mockResolvedValue({});
      prisma.__tx.bed.update.mockResolvedValue({});
      prisma.__tx.bedAllocation.create.mockResolvedValue({ id: 'alloc-2' });
      const service = new RoomsService(prisma);

      await service.transferBed(dto);

      const closeArgs = prisma.__tx.bedAllocation.update.mock.calls[0][0];
      expect(closeArgs.data).toHaveProperty('releasedAt');
      expect(closeArgs.data).not.toHaveProperty('endDate');
      expect(closeArgs.data.isActive).toBe(false);
      expect(closeArgs.data.transferReason).toBe('Step-down to inpatient');

      const createArgs = prisma.__tx.bedAllocation.create.mock.calls[0][0];
      expect(createArgs.data).toEqual({
        bedId: 'bed-2',
        admissionId: 'adm-1',
        isActive: true,
      });
      expect(JSON.stringify(createArgs)).not.toContain('patientId');
    });

    it('rejects an unavailable target bed', async () => {
      const prisma = makePrisma();
      prisma.__tx.bedAllocation.findUnique.mockResolvedValue({
        id: 'alloc-1',
        bedId: 'bed-1',
        admissionId: 'adm-1',
        isActive: true,
      });
      prisma.__tx.bed.findUnique.mockResolvedValue({
        id: 'bed-2',
        bedNumber: 'B2',
        status: 'OCCUPIED',
        isActive: true,
      });
      const service = new RoomsService(prisma);

      await expect(service.transferBed(dto)).rejects.toThrow('not available');
      expect(prisma.__tx.bedAllocation.create).not.toHaveBeenCalled();
    });
  });

  describe('releaseAllocation', () => {
    it('frees the allocation and returns the bed to AVAILABLE', async () => {
      const prisma = makePrisma();
      prisma.bedAllocation.findUnique.mockResolvedValue({
        id: 'alloc-1',
        bedId: 'bed-1',
        isActive: true,
      });
      prisma.__tx.bedAllocation.update.mockResolvedValue({ id: 'alloc-1' });
      prisma.__tx.bedAllocation.findMany.mockResolvedValue([]);
      prisma.__tx.bed.update.mockResolvedValue({});
      const service = new RoomsService(prisma);

      const result = await service.releaseAllocation('alloc-1');

      expect(prisma.__tx.bedAllocation.update).toHaveBeenCalledWith({
        where: { id: 'alloc-1' },
        data: { isActive: false, releasedAt: expect.any(Date) },
      });
      expect(prisma.__tx.bed.update).toHaveBeenCalledWith({
        where: { id: 'bed-1' },
        data: { status: 'AVAILABLE' },
      });
      expect(result).toEqual({ id: 'alloc-1' });
    });

    it('refuses to double-release an allocation', async () => {
      const prisma = makePrisma();
      prisma.bedAllocation.findUnique.mockResolvedValue({
        id: 'alloc-1',
        bedId: 'bed-1',
        isActive: false,
      });
      const service = new RoomsService(prisma);

      await expect(service.releaseAllocation('alloc-1')).rejects.toThrow('already released');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getRoomsAndBeds', () => {
    it('returns rooms with beds and active allocation details', async () => {
      const prisma = makePrisma();
      prisma.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM public."rooms"')) {
          return {
            rows: [
              {
                id: 'room-1',
                room_number: 'R-101',
                room_name: 'Horizon Room 1',
                room_type: 'INPATIENT_MALE',
                floor: 'First',
                wing: 'Horizon Wing',
                is_active: true,
              },
            ],
          };
        }
        return {
          rows: [
            {
              id: 'bed-1',
              room_id: 'room-1',
              bed_number: 'B1',
              status: 'OCCUPIED',
              daily_rate: '6500.00',
              is_active: true,
              allocation_id: 'alloc-1',
              admission_id: 'adm-1',
              allocated_at: '2026-11-20T00:00:00Z',
              admission_number: 'ADM-2026-1234',
              patient_id: 'pat-1',
              first_name: 'Hannah',
              last_name: 'Njoki',
              phone: '+254700000000',
            },
          ],
        };
      });
      const service = new RoomsService(prisma);

      const rooms = await service.getRoomsAndBeds();
      expect(rooms).toHaveLength(1);
      expect(rooms[0].roomNumber).toBe('R-101');
      expect(rooms[0].beds).toHaveLength(1);
      expect(rooms[0].beds[0].dailyRate).toBe(6500);
      expect(rooms[0].beds[0].allocation).toMatchObject({
        id: 'alloc-1',
        admissionNumber: 'ADM-2026-1234',
        patientName: 'Hannah Njoki',
      });
    });

    it('degrades to an empty board instead of throwing', async () => {
      const prisma = makePrisma();
      prisma.query.mockRejectedValue(new Error('connection lost'));
      const service = new RoomsService(prisma);

      await expect(service.getRoomsAndBeds()).resolves.toEqual([]);
    });
  });
});
