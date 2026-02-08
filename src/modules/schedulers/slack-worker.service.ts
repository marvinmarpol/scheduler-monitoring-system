import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SCHEDULER_REPOSITORY } from '@/common/interfaces/scheduler-repository.interface';
import { NOTIFICATION_SERVICE } from '@/common/interfaces/notification-service.interface';
import type { ISchedulerRepository } from '@/common/interfaces/scheduler-repository.interface';
import type { INotificationService } from '@/common/interfaces/notification-service.interface';

@Injectable()
export class SlackWorkerService implements OnModuleInit {
  private readonly logger = new Logger(SlackWorkerService.name);
  private currentMessageTs: string | null = null;
  private readonly startHour: number;
  private readonly endHour: number;
  private readonly timezone: string;

  constructor(
    @Inject(SCHEDULER_REPOSITORY)
    private readonly schedulerRepository: ISchedulerRepository,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: INotificationService,
    private readonly configService: ConfigService,
  ) {
    this.startHour = this.configService.get<number>('SLACK_START_HOUR', 0);
    this.endHour = this.configService.get<number>('SLACK_END_HOUR', 6);
    this.timezone = this.configService.get<string>(
      'SLACK_TIMEZONE',
      'Asia/Jakarta',
    );
  }

  onModuleInit() {
    this.logger.log(
      `SlackWorkerService initialized. Active hours: ${this.startHour}:00 - ${this.endHour}:00 ${this.timezone}`,
    );
  }

  /**
   * Send initial status table at 00:00
   */
  @Cron('0 0 * * *', {
    timeZone: 'Asia/Jakarta',
  })
  async sendInitialStatusTable(): Promise<void> {
    if (!this.notificationService.isEnabled()) {
      this.logger.debug('Notification service is disabled');
      return;
    }

    this.logger.log('Sending initial status table');

    try {
      const schedulers = await this.schedulerRepository.findAll();
      const messageTs = await this.notificationService.sendStatusTable(
        schedulers,
        new Date(),
      );

      this.currentMessageTs = messageTs;
      this.logger.log(`Initial status table sent with timestamp: ${messageTs}`);
    } catch (error) {
      this.logger.error('Failed to send initial status table', error);
    }
  }

  /**
   * Update status table every hour from 01:00 to 05:00
   */
  @Cron(CronExpression.EVERY_HOUR, {
    timeZone: 'Asia/Jakarta',
  })
  async updateStatusTable(): Promise<void> {
    if (!this.notificationService.isEnabled()) {
      return;
    }

    const currentHour = new Date().getHours();

    // Only update between start and end hours (exclusive of start hour)
    if (currentHour <= this.startHour || currentHour > this.endHour) {
      return;
    }

    if (!this.currentMessageTs) {
      this.logger.warn(
        'No current message timestamp found, sending new message',
      );
      await this.sendInitialStatusTable();
      return;
    }

    this.logger.log('Updating status table');

    try {
      const schedulers = await this.schedulerRepository.findAll();
      await this.notificationService.updateStatusTable(
        this.currentMessageTs,
        schedulers,
        new Date(),
      );

      this.logger.log('Status table updated successfully');
    } catch (error) {
      this.logger.error('Failed to update status table', error);
      // If update fails, try sending a new message
      this.currentMessageTs = null;
    }
  }

  /**
   * Send final status summary at 06:00
   */
  @Cron('0 6 * * *', {
    timeZone: 'Asia/Jakarta',
  })
  async sendFinalStatusSummary(): Promise<void> {
    if (!this.notificationService.isEnabled()) {
      return;
    }

    this.logger.log('Sending final status summary');

    try {
      const schedulers = await this.schedulerRepository.findAll();

      // Update the table one last time
      if (this.currentMessageTs) {
        await this.notificationService.updateStatusTable(
          this.currentMessageTs,
          schedulers,
          new Date(),
        );
      }

      // Check if all jobs are completed
      const allCompleted = schedulers.every((s) => s.isCompleted());
      if (allCompleted && schedulers.length > 0) {
        await this.notificationService.sendAllClearSummary(schedulers);
      }

      // Reset message timestamp
      this.currentMessageTs = null;
    } catch (error) {
      this.logger.error('Failed to send final status summary', error);
    }
  }

  /**
   * Check for stale schedulers every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkStaleSchedulers(): Promise<void> {
    const currentHour = new Date().getHours();

    // Only check during active hours
    if (currentHour < this.startHour || currentHour > this.endHour) {
      return;
    }

    this.logger.debug('Checking for stale schedulers');

    try {
      const timeoutMinutes = this.configService.get<number>(
        'HEARTBEAT_TIMEOUT_MINUTES',
        10,
      );
      const staleSchedulers =
        await this.schedulerRepository.findStaleSchedulers(timeoutMinutes);

      for (const scheduler of staleSchedulers) {
        this.logger.warn(`Stale scheduler detected: ${scheduler.scheduler_id}`);
        await this.notificationService.sendTimeoutWarning(scheduler);
      }
    } catch (error) {
      this.logger.error('Failed to check stale schedulers', error);
    }
  }

  /**
   * Cleanup old status history (runs daily at 23:00)
   */
  @Cron('0 23 * * *')
  async cleanupOldHistory(): Promise<void> {
    this.logger.log('Starting cleanup of old status history');

    try {
      // Keep history for 30 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      // Note: This would require injecting the status history repository
      // For now, just log the action
      this.logger.log(
        `Would delete history older than ${cutoffDate.toISOString()}`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup old history', error);
    }
  }
}
