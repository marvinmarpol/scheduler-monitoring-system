import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { RegisterSchedulerDto } from './dto/register-scheduler.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';

@ApiTags('Schedulers')
@Controller('schedulers')
@UseGuards(ApiKeyGuard)
@ApiSecurity('api-key')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new scheduler',
    description: 'Register a new scheduler to be monitored by the system',
  })
  @ApiResponse({
    status: 201,
    description: 'Scheduler registered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid API key',
  })
  async registerScheduler(@Body() dto: RegisterSchedulerDto) {
    return this.schedulerService.registerScheduler(dto);
  }

  @Put(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update scheduler status',
    description: 'Update the status of an existing scheduler',
  })
  @ApiParam({
    name: 'id',
    description: 'Scheduler ID',
    example: 'service-a-eod-process',
  })
  @ApiResponse({
    status: 200,
    description: 'Status updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Scheduler not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid API key',
  })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    // Ensure the ID in the path matches the DTO
    if (id !== dto.scheduler_id) {
      dto.scheduler_id = id;
    }
    return this.schedulerService.updateStatus(dto);
  }

  @Post(':id/heartbeat')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send heartbeat signal',
    description: 'Send a keep-alive signal to indicate the scheduler is still running',
  })
  @ApiParam({
    name: 'id',
    description: 'Scheduler ID',
    example: 'service-a-eod-process',
  })
  @ApiResponse({
    status: 200,
    description: 'Heartbeat recorded successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Scheduler not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid API key',
  })
  async sendHeartbeat(@Param('id') id: string, @Body() dto: HeartbeatDto) {
    await this.schedulerService.updateHeartbeat(id);
    return {
      message: 'Heartbeat recorded',
      scheduler_id: id,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all schedulers',
    description: 'Retrieve a list of all registered schedulers',
  })
  @ApiResponse({
    status: 200,
    description: 'List of schedulers retrieved successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid API key',
  })
  async getAllSchedulers() {
    return this.schedulerService.getAllSchedulers();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get scheduler by ID',
    description: 'Retrieve details of a specific scheduler',
  })
  @ApiParam({
    name: 'id',
    description: 'Scheduler ID',
    example: 'service-a-eod-process',
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduler details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Scheduler not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid API key',
  })
  async getScheduler(@Param('id') id: string) {
    return this.schedulerService.getScheduler(id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Get scheduler status history',
    description: 'Retrieve the status history of a specific scheduler',
  })
  @ApiParam({
    name: 'id',
    description: 'Scheduler ID',
    example: 'service-a-eod-process',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of history entries to retrieve',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Status history retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Scheduler not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid API key',
  })
  async getSchedulerHistory(
    @Param('id') id: string,
    @Query('limit') limit?: number,
  ) {
    return this.schedulerService.getSchedulerHistory(id, limit);
  }
}