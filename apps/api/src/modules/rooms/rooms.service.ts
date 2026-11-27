import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BedStatus } from '@calyvia/shared';

export interface CreateRoomDto {
  roomNumber: string;
  roomName: string;
  roomType: string;
  wing: string;
  floor?: string;
}

export interface CreateBedDto {
  bedNumber: string;
  dailyRate?: number;
}

export interface AllocateBedDto {
  bedId: string;
  /** Kept for API compatibility: the patient link comes from the admission episode. */
  patientId?: string;
  admissionId: string;
}

export interface TransferBedDto {
  currentAllocationId: string;
  newBedId: string;
  transferReason: string;
}

/** Must match the "RoomType" enum in supabase/sql/02_types_and_enums.sql */
const ROOM_TYPES = [
  'DETOX_WARD',
  'INPATIENT_MALE',
  'INPATIENT_FEMALE',
  'VIP_PRIVATE',
  'HIGH_DEPENDENCY_UNIT',
];

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Live occupancy board: rooms with beds, each bed carrying its active
   * allocation and the admitted patient's name. Reads via direct SQL because
   * the generic repository does not hydrate bed -> allocation -> patient.
   */
  async getRoomsAndBeds() {
    try {
      const roomRes = await this.prisma.query(
        `SELECT * FROM public."rooms" WHERE is_active = true ORDER BY wing ASC, room_number ASC`,
      );
      const bedRes = await this.prisma.query(
        `SELECT b.id, b.room_id, b.bed_number, b.status, b.daily_rate, b.is_active,
                ba.id AS allocation_id, ba.admission_id, ba.allocated_at,
                a.admission_number, a.patient_id,
                p.first_name, p.last_name, p.phone
         FROM public."beds" b
         LEFT JOIN public."bed_allocations" ba ON ba.bed_id = b.id AND ba.is_active = true
         LEFT JOIN public."admissions" a ON a.id = ba.admission_id
         LEFT JOIN public."patients" p ON p.id = a.patient_id
         WHERE b.is_active = true
         ORDER BY b.bed_number ASC`,
      );

      const bedsByRoom = new Map<string, any[]>();
      for (const b of bedRes.rows) {
        const bed = {
          id: b.id,
          roomId: b.room_id,
          bedNumber: b.bed_number,
          status: b.status,
          dailyRate: Number(b.daily_rate),
          isActive: b.is_active,
          allocation: b.allocation_id
            ? {
                id: b.allocation_id,
                admissionId: b.admission_id,
                admissionNumber: b.admission_number,
                patientId: b.patient_id,
                patientName:
                  b.first_name || b.last_name
                    ? `${b.first_name || ''} ${b.last_name || ''}`.trim()
                    : 'Unknown patient',
                phone: b.phone || null,
                allocatedAt: b.allocated_at,
              }
            : null,
        };
        const list = bedsByRoom.get(b.room_id) || [];
        list.push(bed);
        bedsByRoom.set(b.room_id, list);
      }

      return roomRes.rows.map((r: any) => ({
        id: r.id,
        roomNumber: r.room_number,
        roomName: r.room_name,
        roomType: r.room_type,
        floor: r.floor,
        wing: r.wing,
        isActive: r.is_active,
        beds: bedsByRoom.get(r.id) || [],
      }));
    } catch (err: any) {
      console.warn('Rooms and beds fetch error:', err);
      return [];
    }
  }

  async createRoom(dto: CreateRoomDto) {
    const roomNumber = dto.roomNumber?.trim();
    const roomName = dto.roomName?.trim();
    const wing = dto.wing?.trim();

    if (!roomNumber || !roomName || !wing) {
      throw new BadRequestException('roomNumber, roomName and wing are required.');
    }
    if (!ROOM_TYPES.includes(dto.roomType)) {
      throw new BadRequestException(`roomType must be one of: ${ROOM_TYPES.join(', ')}`);
    }

    try {
      const existing = await this.prisma.room.findUnique({ where: { roomNumber } });
      if (existing) {
        throw new BadRequestException(`Room ${roomNumber} already exists.`);
      }

      const room = await this.prisma.room.create({
        data: {
          roomNumber,
          roomName,
          roomType: dto.roomType,
          wing,
          floor: dto.floor?.trim() || 'Ground',
        },
      });

      return { ...room, beds: [] };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Failed to create room: ${err.message || 'Database error'}`);
    }
  }

  async createBed(roomId: string, dto: CreateBedDto) {
    const bedNumber = dto.bedNumber?.trim();
    if (!bedNumber) {
      throw new BadRequestException('bedNumber is required.');
    }
    if (dto.dailyRate !== undefined && Number(dto.dailyRate) < 0) {
      throw new BadRequestException('dailyRate cannot be negative.');
    }

    try {
      const room = await this.prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        throw new NotFoundException(`Room ${roomId} not found.`);
      }

      const duplicates = await this.prisma.bed.findMany({
        where: { roomId, bedNumber, isActive: true },
      });
      if (duplicates.length > 0) {
        throw new BadRequestException(`Bed ${bedNumber} already exists in room ${room.roomNumber}.`);
      }

      return await this.prisma.bed.create({
        data: {
          roomId,
          bedNumber,
          dailyRate: dto.dailyRate !== undefined ? Number(dto.dailyRate) : 5000,
        },
      });
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      throw new BadRequestException(`Failed to create bed: ${err.message || 'Database error'}`);
    }
  }

  /**
   * Assign an available bed to an admitted patient.
   * bed_allocations has no patient_id column - the patient is reached through
   * the admission episode, so only bed_id/admission_id are written.
   */
  async allocateBed(dto: AllocateBedDto) {
    if (!dto.bedId || !dto.admissionId) {
      throw new BadRequestException('Bed ID and admission episode ID are required.');
    }

    const admission = await this.prisma.admission.findUnique({
      where: { id: dto.admissionId },
    });
    if (!admission) {
      throw new NotFoundException('Admission episode not found.');
    }
    if (admission.isActive === false) {
      throw new BadRequestException('Admission episode is closed; admit the patient first.');
    }

    const bed = await this.prisma.bed.findUnique({ where: { id: dto.bedId } });
    if (!bed) {
      throw new NotFoundException('Bed not found.');
    }
    if (bed.isActive === false) {
      throw new BadRequestException(`Bed ${bed.bedNumber} is deactivated.`);
    }
    if (bed.status !== 'AVAILABLE') {
      throw new BadRequestException(
        `Bed ${bed.bedNumber} is not available (current status: ${bed.status}).`,
      );
    }

    const activeOnBed = await this.prisma.bedAllocation.findMany({
      where: { bedId: dto.bedId, isActive: true },
    });
    if (activeOnBed.length > 0) {
      throw new BadRequestException('Bed already has an active allocation.');
    }

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const allocation = await tx.bedAllocation.create({
          data: {
            bedId: dto.bedId,
            admissionId: dto.admissionId,
            isActive: true,
          },
        });

        await tx.bed.update({
          where: { id: dto.bedId },
          data: { status: BedStatus.OCCUPIED as any },
        });

        return allocation;
      });
    } catch (err: any) {
      throw new BadRequestException(`Failed to allocate bed: ${err.message || 'Database error'}`);
    }
  }

  async transferBed(dto: TransferBedDto) {
    if (!dto.currentAllocationId || !dto.newBedId) {
      throw new BadRequestException('Current allocation ID and target bed ID are required.');
    }
    if (!dto.transferReason?.trim()) {
      throw new BadRequestException('transferReason is required.');
    }

    try {
      return await this.prisma.$transaction(async (tx: any) => {
        const oldAlloc = await tx.bedAllocation.findUnique({
          where: { id: dto.currentAllocationId },
        });
        if (!oldAlloc) {
          throw new NotFoundException(`Allocation ${dto.currentAllocationId} not found.`);
        }
        if (oldAlloc.isActive === false) {
          throw new BadRequestException('Allocation was already released.');
        }

        const newBed = await tx.bed.findUnique({ where: { id: dto.newBedId } });
        if (!newBed) {
          throw new NotFoundException('Target bed not found.');
        }
        if (newBed.isActive === false) {
          throw new BadRequestException(`Target bed ${newBed.bedNumber} is deactivated.`);
        }
        if (newBed.status !== 'AVAILABLE') {
          throw new BadRequestException(
            `Target bed ${newBed.bedNumber} is not available (current status: ${newBed.status}).`,
          );
        }

        await tx.bedAllocation.update({
          where: { id: dto.currentAllocationId },
          data: {
            isActive: false,
            releasedAt: new Date(),
            transferReason: dto.transferReason.trim(),
          },
        });

        await tx.bed.update({
          where: { id: oldAlloc.bedId },
          data: { status: BedStatus.AVAILABLE as any },
        });

        const newAlloc = await tx.bedAllocation.create({
          data: {
            bedId: dto.newBedId,
            admissionId: oldAlloc.admissionId,
            isActive: true,
          },
        });

        await tx.bed.update({
          where: { id: dto.newBedId },
          data: { status: BedStatus.OCCUPIED as any },
        });

        return newAlloc;
      });
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      throw new BadRequestException(`Failed to transfer bed: ${err.message || 'Database error'}`);
    }
  }

  /** Discharge-side release: free the bed and close the allocation. */
  async releaseAllocation(allocationId: string) {
    try {
      const allocation = await this.prisma.bedAllocation.findUnique({
        where: { id: allocationId },
      });
      if (!allocation) {
        throw new NotFoundException('Allocation not found.');
      }
      if (allocation.isActive === false) {
        throw new BadRequestException('Allocation was already released.');
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const updated = await tx.bedAllocation.update({
          where: { id: allocationId },
          data: { isActive: false, releasedAt: new Date() },
        });

        const remaining = await tx.bedAllocation.findMany({
          where: { bedId: allocation.bedId, isActive: true },
        });
        if (remaining.length === 0) {
          await tx.bed.update({
            where: { id: allocation.bedId },
            data: { status: BedStatus.AVAILABLE as any },
          });
        }

        return updated;
      });
    } catch (err: any) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      throw new BadRequestException(
        `Failed to release allocation: ${err.message || 'Database error'}`,
      );
    }
  }

  /**
   * Delete a bed from the active room board without destroying allocation
   * history. bed_allocations.bed_id is ON DELETE RESTRICT, so a hard delete
   * would fail (or require deleting historical admissions links). Marking the
   * bed inactive keeps past allocations auditable while hiding it from staff.
   */
  async deleteBed(roomId: string, bedId: string) {
    if (!this.prisma.bed || !this.prisma.bedAllocation) {
      throw new ServiceUnavailableException('Bed data service is unavailable.');
    }

    try {
      const bed = await this.prisma.bed.findUnique({ where: { id: bedId } });
      if (!bed || bed.roomId !== roomId) {
        throw new NotFoundException(`Bed ${bedId} not found in room ${roomId}.`);
      }
      if (bed.isActive === false) {
        throw new BadRequestException('This bed has already been deleted.');
      }
      if (bed.status === BedStatus.OCCUPIED || bed.status === BedStatus.RESERVED) {
        throw new BadRequestException(
          'Release or transfer the patient before deleting this bed.',
        );
      }

      const activeAllocations = await this.prisma.bedAllocation.findMany({
        where: { bedId, isActive: true },
      });
      if (activeAllocations.length > 0) {
        throw new BadRequestException(
          'This bed has an active allocation and cannot be deleted.',
        );
      }

      return await this.prisma.$transaction(async (tx: any) => {
        const racedAllocations = await tx.bedAllocation.findMany({
          where: { bedId, isActive: true },
        });
        if (racedAllocations.length > 0) {
          throw new BadRequestException(
            'This bed has an active allocation and cannot be deleted.',
          );
        }

        const deleted = await tx.bed.update({
          where: { id: bedId },
          data: { isActive: false },
        });

        return {
          success: true,
          archived: true,
          id: bedId,
          bedNumber: bed.bedNumber,
          message: `Bed ${bed.bedNumber} was deleted. Past allocations were retained.`,
          bed: deleted,
        };
      });
    } catch (err: any) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException ||
        err instanceof ServiceUnavailableException
      ) {
        throw err;
      }
      throw new BadRequestException(`Failed to delete bed: ${err.message || 'Database error'}`);
    }
  }
}
