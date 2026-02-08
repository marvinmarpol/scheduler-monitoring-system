import { IsString, IsEmail, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterSchedulerDto {
  @ApiProperty({
    description: 'Unique identifier for the scheduler',
    example: 'service-a-eod-process',
  })
  @IsString()
  @MaxLength(255)
  scheduler_id: string;

  @ApiProperty({
    description: 'Name of the service',
    example: 'Service A',
  })
  @IsString()
  @MaxLength(255)
  service_name: string;

  @ApiProperty({
    description: 'Name of the job',
    example: 'EOD Processing',
  })
  @IsString()
  @MaxLength(255)
  job_name: string;

  @ApiPropertyOptional({
    description: 'Email of the service owner',
    example: 'owner@example.com',
  })
  @IsOptional()
  @IsEmail()
  owner_email?: string;

  @ApiPropertyOptional({
    description: 'Slack user ID for alerts',
    example: 'U1234567890',
  })
  @IsOptional()
  @IsString()
  alert_user_id?: string;
}