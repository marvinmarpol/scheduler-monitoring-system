import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebClient } from '@slack/web-api';
import { INotificationService } from '@/common/interfaces/notification-service.interface';
import { Scheduler } from '@/common/entities/scheduler.entity';
import { STATUS_EMOJI, SchedulerStatus } from '@/common/enums/scheduler-status.enum';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class SlackNotificationService implements INotificationService {
  private readonly logger = new Logger(SlackNotificationService.name);
  private readonly client: WebClient;
  private readonly channelId: string;
  private readonly enabled: boolean;
  private readonly timezone: string;

  constructor(private configService: ConfigService) {
    const token = this.configService.get<string>('SLACK_BOT_TOKEN');
    this.channelId = this.configService.get<string>('SLACK_CHANNEL_ID') || '';
    this.enabled = this.configService.get<boolean>('SLACK_ENABLED', true);
    this.timezone = this.configService.get<string>(
      'SLACK_TIMEZONE',
      'Asia/Jakarta',
    );

    this.client = new WebClient(token);

    if (this.enabled && !token) {
      this.logger.warn('Slack is enabled but bot token is not configured');
    }
  }

  async sendStatusTable(
    schedulers: Scheduler[],
    timestamp: Date,
  ): Promise<string> {
    if (!this.enabled) {
      this.logger.debug('Slack is disabled, skipping status table send');
      return '';
    }

    const blocks = this.buildStatusTableBlocks(schedulers, timestamp);

    try {
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        blocks,
        text: 'EOD Process Status Update',
      });

      this.logger.log('Status table sent to Slack');
      return result.ts as string;
    } catch (error) {
      this.logger.error('Failed to send status table to Slack', error);
      throw error;
    }
  }

  async updateStatusTable(
    messageTs: string,
    schedulers: Scheduler[],
    timestamp: Date,
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Slack is disabled, skipping status table update');
      return;
    }

    const blocks = this.buildStatusTableBlocks(schedulers, timestamp);

    try {
      await this.client.chat.update({
        channel: this.channelId,
        ts: messageTs,
        blocks,
        text: 'EOD Process Status Update',
      });

      this.logger.log('Status table updated in Slack');
    } catch (error) {
      this.logger.error('Failed to update status table in Slack', error);
      throw error;
    }
  }

  async sendFailedJobAlert(scheduler: Scheduler): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Slack is disabled, skipping failed job alert');
      return;
    }

    const userMention = scheduler.alert_user_id
      ? `<@${scheduler.alert_user_id}>`
      : '@channel';

    const blocks : any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Job Failed Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Service:*\n${scheduler.service_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Job:*\n${scheduler.job_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${STATUS_EMOJI[scheduler.status]} ${scheduler.status}`,
          },
          {
            type: 'mrkdwn',
            text: `*Time:*\n${this.formatTimestamp(scheduler.timestamp)}`,
          },
        ],
      },
    ];

    if (scheduler.error_message) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Message:*\n\`\`\`${scheduler.error_message}\`\`\``,
        },
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `${userMention} Please investigate this issue.`,
        },
      ],
    });

    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        blocks,
        text: `Job Failed: ${scheduler.service_name} - ${scheduler.job_name}`,
      });

      this.logger.log(
        `Failed job alert sent for scheduler: ${scheduler.scheduler_id}`,
      );
    } catch (error) {
      this.logger.error('Failed to send failed job alert to Slack', error);
      throw error;
    }
  }

  async sendTimeoutWarning(scheduler: Scheduler): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Slack is disabled, skipping timeout warning');
      return;
    }

    const userMention = scheduler.alert_user_id
      ? `<@${scheduler.alert_user_id}>`
      : '@channel';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ Job Timeout Warning',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Service:*\n${scheduler.service_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Job:*\n${scheduler.job_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${STATUS_EMOJI[scheduler.status]} ${scheduler.status}`,
          },
          {
            type: 'mrkdwn',
            text: `*Last Heartbeat:*\n${this.formatTimestamp(scheduler.last_heartbeat)}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `${userMention} No heartbeat received within threshold. Job may be stuck.`,
          },
        ],
      },
    ];

    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        blocks,
        text: `Job Timeout: ${scheduler.service_name} - ${scheduler.job_name}`,
      });

      this.logger.log(
        `Timeout warning sent for scheduler: ${scheduler.scheduler_id}`,
      );
    } catch (error) {
      this.logger.error('Failed to send timeout warning to Slack', error);
      throw error;
    }
  }

  async sendAllClearSummary(schedulers: Scheduler[]): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('Slack is disabled, skipping all clear summary');
      return;
    }

    const completedCount = schedulers.filter((s) => s.isCompleted()).length;
    const totalCount = schedulers.length;
    const totalExecutionTime = schedulers
      .filter((s) => s.execution_time_ms)
      .reduce((sum, s) => sum + (s.execution_time_ms || 0), 0);

    const blocks : any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ All EOD Jobs Completed',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Total Jobs:*\n${totalCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Completed:*\n${completedCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Total Execution Time:*\n${this.formatExecutionTime(totalExecutionTime)}`,
          },
          {
            type: 'mrkdwn',
            text: `*Completion Time:*\n${this.formatTimestamp(new Date())}`,
          },
        ],
      },
      {
        type: 'divider',
      },
    ];

    // Add individual job summaries
    schedulers.forEach((scheduler) => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${STATUS_EMOJI[scheduler.status]} *${scheduler.service_name}* - ${scheduler.job_name}\n_Execution time: ${this.formatExecutionTime(scheduler.execution_time_ms || 0)}_`,
        },
      });
    });

    try {
      await this.client.chat.postMessage({
        channel: this.channelId,
        blocks,
        text: 'All EOD Jobs Completed',
      });

      this.logger.log('All clear summary sent to Slack');
    } catch (error) {
      this.logger.error('Failed to send all clear summary to Slack', error);
      throw error;
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private buildStatusTableBlocks(
    schedulers: Scheduler[],
    timestamp: Date,
  ): any[] {
    const formattedTime = this.formatTimestamp(timestamp);

    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 EOD Process Status - ${formattedTime}`,
          emoji: true,
        },
      },
      {
        type: 'divider',
      },
    ];

    // Build status summary
    const summary = this.buildStatusSummary(schedulers);
    blocks.push({
      type: 'section',
      fields: Object.entries(summary).map(([status, count]) => ({
        type: 'mrkdwn',
        text: `*${status}:* ${count}`,
      })),
    });

    blocks.push({
      type: 'divider',
    });

    // Add individual scheduler status
    schedulers.forEach((scheduler) => {
      blocks.push({
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Service:*\n${scheduler.service_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Job:*\n${scheduler.job_name}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n${STATUS_EMOJI[scheduler.status]} ${scheduler.status}`,
          },
          {
            type: 'mrkdwn',
            text: `*Updated:*\n${this.formatTimestamp(scheduler.updated_at)}`,
          },
        ],
      });

      if (scheduler.execution_time_ms) {
        blocks.push({
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Execution time: ${this.formatExecutionTime(scheduler.execution_time_ms)}`,
            },
          ],
        });
      }
    });

    // Add legend
    blocks.push(
      {
        type: 'divider',
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Legend: ${STATUS_EMOJI[SchedulerStatus.PENDING]} Pending | ${STATUS_EMOJI[SchedulerStatus.RUNNING]} Running | ${STATUS_EMOJI[SchedulerStatus.COMPLETED]} Success | ${STATUS_EMOJI[SchedulerStatus.FAILED]} Failed`,
          },
        ],
      },
    );

    return blocks;
  }

  private buildStatusSummary(
    schedulers: Scheduler[],
  ): Record<string, number> {
    const summary: Record<string, number> = {
      Pending: 0,
      Running: 0,
      Completed: 0,
      Failed: 0,
    };

    schedulers.forEach((scheduler) => {
      switch (scheduler.status) {
        case SchedulerStatus.PENDING:
          summary.Pending++;
          break;
        case SchedulerStatus.RUNNING:
          summary.Running++;
          break;
        case SchedulerStatus.COMPLETED:
          summary.Completed++;
          break;
        case SchedulerStatus.FAILED:
          summary.Failed++;
          break;
      }
    });

    return summary;
  }

  private formatTimestamp(date: Date | undefined): string {
    if (!date) {
      return 'N/A';
    }
    return dayjs(date).tz(this.timezone).format('DD MMM YYYY HH:mm:ss');
  }

  private formatExecutionTime(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }
}