import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Lightweight health check endpoint' })
  @ApiResponse({ status: 200, description: 'API service is operational' })
  getHealth() {
    return {
      status: 'live',
      service: 'Calyvia Wellness Center API',
      // This is a liveness probe only; database and gateway readiness are not checked.
      dependencyChecks: 'not_performed',
      timestamp: new Date().toISOString(),
    };
  }
}
