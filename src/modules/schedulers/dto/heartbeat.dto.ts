import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HeartbeatDto {
  @ApiProperty({
    description: 'Unique identifier for the scheduler',
    example: 'service-a-eod-process',
  })
  @IsString()
  scheduler_id: string;
}
