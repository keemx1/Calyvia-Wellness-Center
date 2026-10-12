import { Controller, Post, Body, Get, Patch, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import {
  LoginDto,
  RefreshTokenDto,
  RequestAccessDto,
  ChangePasswordDto,
  ApproveAccessDto,
  RejectAccessDto,
  UpdateUserStatusDto,
  UpdateProfileDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('Security & Authentication (Module 24)')
@Controller('auth')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Staff login using email & password' })
  @ApiResponse({ status: 200, description: 'JWT tokens and user profile returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account not authorized' })
  async login(@Body() loginDto: LoginDto) {
    return this.securityService.login(loginDto);
  }

  @Post('request-access')
  @HttpCode(HttpStatus.FORBIDDEN)
  @ApiOperation({ summary: 'RETIRED: Self-service staff registration is disabled' })
  @ApiResponse({ status: 403, description: 'Self-service registration disabled' })
  async requestAccess(@Body() dto: RequestAccessDto) {
    return this.securityService.requestAccess(dto);
  }

  @Get('pending-requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all pending employee authorization requests' })
  async getPendingRequests() {
    return this.securityService.getPendingRequests();
  }

  @Post('approve-request/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve pending employee account and assign authorized role' })
  async approveRequest(
    @CurrentUser() admin: any,
    @Param('id') id: string,
    @Body() dto: ApproveAccessDto,
  ) {
    return this.securityService.approveRequest(admin?.id || admin?.sub, id, dto);
  }

  @Post('reject-request/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline pending employee account request' })
  async rejectRequest(
    @CurrentUser() admin: any,
    @Param('id') id: string,
    @Body() dto: RejectAccessDto,
  ) {
    return this.securityService.rejectRequest(admin?.id || admin?.sub, id, dto);
  }

  @Post('update-status/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.FACILITY_ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate, suspend, or update institutional employee account' })
  async updateStatus(
    @CurrentUser() admin: any,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.securityService.updateUserStatus(admin?.id || admin?.sub, id, dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain new access token using refresh token' })
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    return this.securityService.refreshToken(refreshDto.refreshToken);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for authenticated staff or primary administrator' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.securityService.changePassword(user.id || user.sub, dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout staff and invalidate authentication session' })
  @ApiResponse({ status: 200, description: 'Session invalidated and logout recorded' })
  async logout(@CurrentUser() user: any) {
    return this.securityService.logout(user?.id || user?.sub);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retrieve currently authenticated user profile and roles' })
  async getProfile(@CurrentUser() user: any) {
    return {
      authenticated: true,
      user,
    };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update personal profile details for authenticated user' })
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    const userId = user?.id || user?.sub;
    return this.securityService.updateProfile(userId, dto);
  }
}
