import { SchedulerStatus } from '@/common/enums/scheduler-status.enum';
import { SchedulerMetadata } from './scheduler.entity';

export class StatusHistory {
  id: string;
  scheduler_id: string;
  status: SchedulerStatus;
  timestamp: Date;
  execution_time_ms?: number;
  error_message?: string;
  metadata?: SchedulerMetadata;

  constructor(partial: Partial<StatusHistory>) {
    Object.assign(this, partial);
  }
}
