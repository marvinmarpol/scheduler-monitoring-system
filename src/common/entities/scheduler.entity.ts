import { SchedulerStatus } from '@/common/enums/scheduler-status.enum';

export interface SchedulerMetadata {
  records_processed?: number;
  [key: string]: any;
}

export class Scheduler {
  scheduler_id: string;
  service_name: string;
  job_name: string;
  status: SchedulerStatus;
  timestamp: Date;
  execution_time_ms?: number;
  error_message?: string;
  metadata?: SchedulerMetadata;
  last_heartbeat?: Date;
  created_at: Date;
  updated_at: Date;
  owner_email?: string;
  alert_user_id?: string;

  constructor(partial: Partial<Scheduler>) {
    Object.assign(this, partial);
  }

  isStale(timeoutMinutes: number): boolean {
    if (!this.last_heartbeat) {
      return false;
    }
    const now = new Date();
    const diff = now.getTime() - this.last_heartbeat.getTime();
    return diff > timeoutMinutes * 60 * 1000;
  }

  isPending(): boolean {
    return this.status === SchedulerStatus.PENDING;
  }

  isRunning(): boolean {
    return this.status === SchedulerStatus.RUNNING;
  }

  isCompleted(): boolean {
    return this.status === SchedulerStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.status === SchedulerStatus.FAILED;
  }

  markAsRunning(): void {
    this.status = SchedulerStatus.RUNNING;
    this.updated_at = new Date();
  }

  markAsCompleted(executionTimeMs?: number): void {
    this.status = SchedulerStatus.COMPLETED;
    this.execution_time_ms = executionTimeMs;
    this.error_message = undefined;
    this.updated_at = new Date();
  }

  markAsFailed(errorMessage: string): void {
    this.status = SchedulerStatus.FAILED;
    this.error_message = errorMessage;
    this.updated_at = new Date();
  }
}
