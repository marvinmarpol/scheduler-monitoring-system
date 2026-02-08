import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Scheduler } from '@/common/entities/scheduler.entity';
import { StatusHistory } from '@/common/entities/status-history.entity';
import { SchedulerStatus } from '@/common/enums/scheduler-status.enum';
import { RegisterSchedulerDto } from './dto/register-scheduler.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { SCHEDULER_REPOSITORY } from '@/common/interfaces/scheduler-repository.interface';
import { STATUS_HISTORY_REPOSITORY } from '@/common/interfaces/status-history-repository.interface';
import { NOTIFICATION_SERVICE } from '@/common/interfaces/notification-service.interface';
import type { ISchedulerRepository } from '@/common/interfaces/scheduler-repository.interface';
import type { IStatusHistoryRepository } from '@/common/interfaces/status-history-repository.interface';
import type { INotificationService } from '@/common/interfaces/notification-service.interface';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly heartbeatTimeoutMinutes: number;

  constructor(
    @Inject(SCHEDULER_REPOSITORY)
    private readonly schedulerRepository: ISchedulerRepository,
    @Inject(STATUS_HISTORY_REPOSITORY)
    private readonly statusHistoryRepository: IStatusHistoryRepository,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: INotificationService,
    private readonly configService: ConfigService,
  ) {
    this.heartbeatTimeoutMinutes = this.configService.get<number>(
      'HEARTBEAT_TIMEOUT_MINUTES',
      10,
    );
  }

  async registerScheduler(dto: RegisterSchedulerDto): Promise<Scheduler> {
    this.logger.log(`Registering scheduler: ${dto.scheduler_id}`);

    // Check if scheduler already exists
    const existing = await this.schedulerRepository.findById(dto.scheduler_id);
    if (existing) {
      this.logger.warn(
        `Scheduler ${dto.scheduler_id} already exists, updating instead`,
      );
      return this.schedulerRepository.update(dto.scheduler_id, {
        service_name: dto.service_name,
        job_name: dto.job_name,
        owner_email: dto.owner_email,
        alert_user_id: dto.alert_user_id,
      });
    }

    const scheduler = new Scheduler({
      scheduler_id: dto.scheduler_id,
      service_name: dto.service_name,
      job_name: dto.job_name,
      status: SchedulerStatus.PENDING,
      timestamp: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
      owner_email: dto.owner_email,
      alert_user_id: dto.alert_user_id,
    });

    return this.schedulerRepository.create(scheduler);
  }

  async updateStatus(dto: UpdateStatusDto): Promise<Scheduler> {
    this.logger.log(
      `Updating status for scheduler: ${dto.scheduler_id} to ${dto.status}`,
    );

    const existing = await this.schedulerRepository.findById(dto.scheduler_id);
    if (!existing) {
      throw new NotFoundException(
        `Scheduler ${dto.scheduler_id} not found. Please register first.`,
      );
    }

    // Update scheduler
    const updates: Partial<Scheduler> = {
      service_name: dto.service_name,
      job_name: dto.job_name,
      status: dto.status,
      timestamp: new Date(dto.timestamp),
      execution_time_ms: dto.execution_time_ms,
      error_message: dto.error_message,
      metadata: dto.metadata,
      last_heartbeat: new Date(), // Update heartbeat on status change
    };

    const updatedScheduler = await this.schedulerRepository.update(
      dto.scheduler_id,
      updates,
    );

    // Create status history entry
    await this.createStatusHistory(updatedScheduler);

    // Send alert if job failed
    if (dto.status === SchedulerStatus.FAILED) {
      await this.handleFailedJob(updatedScheduler);
    }

    return updatedScheduler;
  }

  async updateHeartbeat(schedulerId: string): Promise<void> {
    this.logger.debug(`Updating heartbeat for scheduler: ${schedulerId}`);

    const existing = await this.schedulerRepository.findById(schedulerId);
    if (!existing) {
      throw new NotFoundException(
        `Scheduler ${schedulerId} not found. Please register first.`,
      );
    }

    await this.schedulerRepository.updateHeartbeat(schedulerId);
  }

  async getScheduler(schedulerId: string): Promise<Scheduler> {
    const scheduler = await this.schedulerRepository.findById(schedulerId);
    if (!scheduler) {
      throw new NotFoundException(`Scheduler ${schedulerId} not found`);
    }
    return scheduler;
  }

  async getAllSchedulers(): Promise<Scheduler[]> {
    return this.schedulerRepository.findAll();
  }

  async getSchedulerHistory(
    schedulerId: string,
    limit?: number,
  ): Promise<StatusHistory[]> {
    return this.statusHistoryRepository.findBySchedulerId(schedulerId, limit);
  }

  async checkStaleSchedulers(): Promise<void> {
    this.logger.log('Checking for stale schedulers');

    const staleSchedulers = await this.schedulerRepository.findStaleSchedulers(
      this.heartbeatTimeoutMinutes,
    );

    for (const scheduler of staleSchedulers) {
      this.logger.warn(`Stale scheduler detected: ${scheduler.scheduler_id}`);
      await this.notificationService.sendTimeoutWarning(scheduler);
    }
  }

  async checkAllClear(): Promise<boolean> {
    const schedulers = await this.schedulerRepository.findAll();

    const allCompleted = schedulers.every((s) => s.isCompleted());

    if (allCompleted && schedulers.length > 0) {
      this.logger.log('All schedulers completed successfully');
      await this.notificationService.sendAllClearSummary(schedulers);
      return true;
    }

    return false;
  }

  private async createStatusHistory(scheduler: Scheduler): Promise<void> {
    const history = new StatusHistory({
      scheduler_id: scheduler.scheduler_id,
      status: scheduler.status,
      timestamp: scheduler.timestamp,
      execution_time_ms: scheduler.execution_time_ms,
      error_message: scheduler.error_message,
      metadata: scheduler.metadata,
    });

    await this.statusHistoryRepository.create(history);
  }

  private async handleFailedJob(scheduler: Scheduler): Promise<void> {
    this.logger.error(
      `Job failed: ${scheduler.scheduler_id} - ${scheduler.error_message}`,
    );
    await this.notificationService.sendFailedJobAlert(scheduler);
  }
}
