import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService, CreateTaskDto } from './tasks.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLog } from '../../common/decorators/audit-log.decorator';
import { UserRole } from '@calyvia/shared';

@ApiTags('13. Task Management')
@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @Roles(...Object.values(UserRole))
  @AuditLog({ action: 'CREATE_STAFF_TASK', resource: 'TASK' })
  @ApiOperation({ summary: 'Assign operational or clinical task to staff member' })
  async createTask(@CurrentUser('id') userId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.createTask(userId || '00000000-0000-0000-0000-000000000001', dto);
  }

  @Get()
  @Roles(...Object.values(UserRole))
  @ApiOperation({ summary: 'List tasks with status filter (pending, overdue, completed)' })
  async getTasks(@Query('status') status?: string) {
    return this.tasksService.getTasks(status);
  }
}
