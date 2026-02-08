import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service'
import { SlackWorkerService } from './slack-worker.service';
import { SCHEDULER_REPOSITORY } from '@/common/interfaces/scheduler-repository.interface';
import { STATUS_HISTORY_REPOSITORY } from '@/common/interfaces/status-history-repository.interface';
import { NOTIFICATION_SERVICE } from '@/common/interfaces/notification-service.interface';
import { DynamoDBSchedulerRepository } from '@/infrastructure/database/dynamodb/dynamodb-scheduler.repository';
import { DynamoDBStatusHistoryRepository } from '@/infrastructure/database/dynamodb/dynamodb-status-history.repository';
import { SlackNotificationService } from '@/infrastructure/notification/slack/slack-notification.service';

@Module({
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    SlackWorkerService,
    {
      provide: SCHEDULER_REPOSITORY,
      useClass: DynamoDBSchedulerRepository,
    },
    {
      provide: STATUS_HISTORY_REPOSITORY,
      useClass: DynamoDBStatusHistoryRepository,
    },
    {
      provide: NOTIFICATION_SERVICE,
      useClass: SlackNotificationService,
    },
  ],
  exports: [SchedulerService],
})
export class SchedulerModule {}