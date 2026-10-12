import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { StaffService } from './staff.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';
import {
  CreateStaffAccountDto,
  UpdateStaffAccountDto,
  ResetStaffPasswordDto,
  UpdateStaffStatusDto,
} from './dto/staff.dto';

@ApiTags('12. Staff Management & Access Control')
@Controller('staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @ApiOperation({ summary: 'List all staff accounts with roles, departments, and status' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getStaff(
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.staffService.getStaffAccounts({ search, department, role, status });
  }

  @Get('accounts')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.FACILITY_ADMIN,
    UserRole.MEDICAL_DIRECTOR,
    UserRole.MANAGEMENT_EXECUTIVE,
  )
  @ApiOperation({ summary: 'List staff accounts with filtering' })
  async getStaffAccounts(
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.staffService.getStaffAccounts({ search, department, role, status });
  }

  @Post('create-account')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @AuditLog({ action: 'CREATE_STAFF_ACCOUNT', resource: 'STAFF' })
  @ApiOperation({ summary: 'Administrator-controlled creation of a new staff account' })
  @ApiResponse({ status: 201, description: 'Staff account and credentials created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate email' })
  @ApiResponse({ status: 403, description: 'Unauthorized or privilege escalation attempt' })
  async createStaffAccount(
    @CurrentUser() admin: any,
    @Body() dto: CreateStaffAccountDto,
  ) {
    return this.staffService.createStaffAccount(admin, dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @HttpCode(HttpStatus.OK)
  @AuditLog({ action: 'UPDATE_STAFF_ACCOUNT', resource: 'STAFF' })
  @ApiOperation({ summary: 'Update employee details, professional license, and assigned role' })
  async updateStaffAccount(
    @CurrentUser() admin: any,
    @Param('id') id: string,
    @Body() dto: UpdateStaffAccountDto,
  ) {
    return this.staffService.updateStaffAccount(admin, id, dto);
  }

  @Post(':id/reset-password')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @HttpCode(HttpStatus.OK)
  @AuditLog({ action: 'RESET_STAFF_PASSWORD', resource: 'STAFF' })
  @ApiOperation({ summary: 'Administrator resets and provisions new credentials for staff' })
  async resetStaffPassword(
    @CurrentUser() admin: any,
    @Param('id') id: string,
    @Body() dto: ResetStaffPasswordDto,
  ) {
    return this.staffService.resetStaffPassword(admin, id, dto);
  }

  @Post(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @HttpCode(HttpStatus.OK)
  @AuditLog({ action: 'UPDATE_STAFF_STATUS', resource: 'STAFF' })
  @ApiOperation({ summary: 'Activate, suspend, or deactivate an employee account' })
  async updateStaffStatus(
    @CurrentUser() admin: any,
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
  ) {
    return this.staffService.updateStaffStatus(admin, id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @HttpCode(HttpStatus.OK)
  @AuditLog({ action: 'UPDATE_STAFF_STATUS', resource: 'STAFF' })
  @ApiOperation({ summary: 'Patch staff account status (activate / suspend / deactivate)' })
  async patchStaffStatus(
    @CurrentUser() admin: any,
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
  ) {
    return this.staffService.updateStaffStatus(admin, id, dto);
  }

  @Get('licences/expiring')
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN, UserRole.MEDICAL_DIRECTOR)
  @ApiOperation({ summary: 'Audit clinical staff professional licences approaching expiry' })
  async getExpiringLicences() {
    return this.staffService.getExpiringLicences();
  }
}
