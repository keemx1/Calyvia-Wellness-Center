import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  RoomsService,
  AllocateBedDto,
  TransferBedDto,
  CreateRoomDto,
  CreateBedDto,
} from './rooms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('09. Rooms & Beds Allocation')
@Controller('rooms')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.ADMISSIONS_FRONT_DESK,
    UserRole.NURSE,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @ApiOperation({ summary: 'Get visual occupancy board for all wards and beds' })
  async getRoomsAndBeds() {
    return this.roomsService.getRoomsAndBeds();
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @AuditLog({ action: 'CREATE_ROOM', resource: 'ROOM' })
  @ApiOperation({ summary: 'Create an inpatient room' })
  async createRoom(@Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(dto);
  }

  @Post(':id/beds')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @AuditLog({ action: 'CREATE_BED', resource: 'BED' })
  @ApiOperation({ summary: 'Add a bed to an existing room' })
  async createBed(@Param('id') id: string, @Body() dto: CreateBedDto) {
    return this.roomsService.createBed(id, dto);
  }

  @Post('allocations')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.ADMISSIONS_FRONT_DESK, UserRole.NURSE)
  @AuditLog({ action: 'ALLOCATE_BED', resource: 'BED_ALLOCATION' })
  @ApiOperation({ summary: 'Assign available bed to an admitted patient' })
  async allocateBed(@Body() dto: AllocateBedDto) {
    return this.roomsService.allocateBed(dto);
  }

  @Post('allocations/:id/release')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.NURSE, UserRole.MEDICAL_DIRECTOR)
  @AuditLog({ action: 'RELEASE_BED_ALLOCATION', resource: 'BED_ALLOCATION' })
  @ApiOperation({ summary: 'Release an active bed allocation and free the bed' })
  async releaseAllocation(@Param('id') id: string) {
    return this.roomsService.releaseAllocation(id);
  }

  @Post('transfers')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.NURSE, UserRole.MEDICAL_DIRECTOR)
  @AuditLog({ action: 'TRANSFER_BED', resource: 'BED_ALLOCATION' })
  @ApiOperation({ summary: 'Transfer patient between beds or wards (e.g. Detox to Inpatient)' })
  async transferBed(@Body() dto: TransferBedDto) {
    return this.roomsService.transferBed(dto);
  }
}
