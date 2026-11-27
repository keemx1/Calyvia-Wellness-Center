import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MovementService, CreateMovementDto, RegisterVisitorDto } from './movement.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('10. Patient Movement & Visitors')
@Controller('movement')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Post('passes')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.ADMISSIONS_FRONT_DESK,
  )
  @AuditLog({ action: 'AUTHORIZE_PATIENT_PASS', resource: 'PATIENT_MOVEMENT' })
  @ApiOperation({ summary: 'Issue medical escort or therapeutic gate pass' })
  async recordMovement(@Body() dto: CreateMovementDto) {
    return this.movementService.recordMovement(dto);
  }

  @Post('visitors')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.ADMISSIONS_FRONT_DESK,
  )
  @AuditLog({ action: 'REGISTER_VISITOR', resource: 'VISITOR_LOG' })
  @ApiOperation({ summary: 'Register gate visitor with contraband screening check' })
  async registerVisitor(@Body() dto: RegisterVisitorDto) {
    return this.movementService.registerVisitor(dto);
  }

  @Get('visitors')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.DOCTOR_PSYCHIATRIST,
    UserRole.NURSE,
    UserRole.ADMISSIONS_FRONT_DESK,
  )
  @ApiOperation({ summary: 'List recent visitor gate logs' })
  async getVisitors() {
    return this.movementService.getRecentVisitors();
  }
}
