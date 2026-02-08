import {
  IsString,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { SchedulerStatus } from '@/common/enums/scheduler-status.enum';
import type { SchedulerMetadata } from '@/common/entities/scheduler.entity';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'Unique identifier for the scheduler',
    example: 'service-a-eod-process',
  })
  @IsString()
  scheduler_id: string;

  @ApiProperty({
    description: 'Name of the service',
    example: 'Service A',
  })
  @IsString()
  service_name: string;

  @ApiProperty({
    description: 'Name of the job',
    example: 'EOD Processing',
  })
  @IsString()
  job_name: string;

  @ApiProperty({
    description: 'Status of the scheduler',
    enum: SchedulerStatus,
    example: SchedulerStatus.RUNNING,
  })
  @IsEnum(SchedulerStatus)
  status: SchedulerStatus;

  @ApiProperty({
    description: 'Timestamp of the status update',
    example: '2024-01-15T00:30:00Z',
  })
  @IsISO8601()
  timestamp: string;

  @ApiPropertyOptional({
    description: 'Execution time in milliseconds',
    example: 15000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  execution_time_ms?: number;

  @ApiPropertyOptional({
    description: 'Error message if status is failed',
    example: 'Database connection timeout',
  })
  @IsOptional()
  @IsString()
  error_message?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { records_processed: 1000, custom_field: 'value' },
  })
  @IsOptional()
  @IsObject()
  metadata?: SchedulerMetadata;
}
