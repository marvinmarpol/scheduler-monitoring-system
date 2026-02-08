import { Scheduler } from '@/common/entities/scheduler.entity';

export interface NotificationMessage {
  schedulerId: string;
  type: 'status_update' | 'alert' | 'summary';
  data: any;
}

export interface INotificationService {
  /**
   * Send status table to Slack
   */
  sendStatusTable(schedulers: Scheduler[], timestamp: Date): Promise<string>;

  /**
   * Update existing status table message
   */
  updateStatusTable(
    messageTs: string,
    schedulers: Scheduler[],
    timestamp: Date,
  ): Promise<void>;

  /**
   * Send alert for failed job
   */
  sendFailedJobAlert(scheduler: Scheduler): Promise<void>;

  /**
   * Send timeout warning
   */
  sendTimeoutWarning(scheduler: Scheduler): Promise<void>;

  /**
   * Send all clear summary
   */
  sendAllClearSummary(schedulers: Scheduler[]): Promise<void>;

  /**
   * Check if service is enabled
   */
  isEnabled(): boolean;
}

export const NOTIFICATION_SERVICE = Symbol('INotificationService');