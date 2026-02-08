import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

import { ISchedulerRepository } from '@/common/interfaces/scheduler-repository.interface';
import { Scheduler } from '@/common/entities/scheduler.entity';
import { SchedulerStatus } from '@/common/enums/scheduler-status.enum';

@Injectable()
export class DynamoDBSchedulerRepository implements ISchedulerRepository {
  private readonly logger = new Logger(DynamoDBSchedulerRepository.name);
  private readonly dynamoDB: AWS.DynamoDB.DocumentClient;
  private readonly tableName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const endpoint = this.configService.get<string>('DYNAMODB_ENDPOINT');

    const config: AWS.DynamoDB.DocumentClient.DocumentClientOptions &
      AWS.DynamoDB.Types.ClientConfiguration = {
      region,
    };

    if (endpoint) {
      config.endpoint = endpoint;
    }

    this.dynamoDB = new AWS.DynamoDB.DocumentClient(config);
    this.tableName = this.configService.get<string>('DYNAMODB_TABLE_SCHEDULERS') || '';
  }

  async create(scheduler: Scheduler): Promise<Scheduler> {
    const now = new Date();
    const item = {
      ...scheduler,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      timestamp: scheduler.timestamp.toISOString(),
      last_heartbeat: scheduler.last_heartbeat?.toISOString(),
    };

    await this.dynamoDB
      .put({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(scheduler_id)',
      })
      .promise();

    this.logger.log(`Created scheduler: ${scheduler.scheduler_id}`);
    return this.mapToEntity(item);
  }

  async findById(schedulerId: string): Promise<Scheduler | null> {
    const result = await this.dynamoDB
      .get({
        TableName: this.tableName,
        Key: { scheduler_id: schedulerId },
      })
      .promise();

    return result.Item ? this.mapToEntity(result.Item) : null;
  }

  async findAll(): Promise<Scheduler[]> {
    const result = await this.dynamoDB
      .scan({
        TableName: this.tableName,
      })
      .promise();

    return (result.Items || []).map((item) => this.mapToEntity(item));
  }

  async update(
    schedulerId: string,
    updates: Partial<Scheduler>,
  ): Promise<Scheduler> {
    const timestamp = new Date().toISOString();

    // Build update expression
    const updateExpressions: string[] = ['updated_at = :updated_at'];
    const expressionAttributeValues: any = {
      ':updated_at': timestamp,
    };
    const expressionAttributeNames: any = {};

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'scheduler_id' && value !== undefined) {
        const placeholder = `:${key}`;
        const namePlaceholder = `#${key}`;

        expressionAttributeNames[namePlaceholder] = key;
        updateExpressions.push(`${namePlaceholder} = ${placeholder}`);

        if (value instanceof Date) {
          expressionAttributeValues[placeholder] = value.toISOString();
        } else {
          expressionAttributeValues[placeholder] = value;
        }
      }
    });

    const result = await this.dynamoDB
      .update({
        TableName: this.tableName,
        Key: { scheduler_id: schedulerId },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames:
          Object.keys(expressionAttributeNames).length > 0
            ? expressionAttributeNames
            : undefined,
        ReturnValues: 'ALL_NEW',
      })
      .promise();

    this.logger.log(`Updated scheduler: ${schedulerId}`);
    return this.mapToEntity(result.Attributes);
  }

  async delete(schedulerId: string): Promise<void> {
    await this.dynamoDB
      .delete({
        TableName: this.tableName,
        Key: { scheduler_id: schedulerId },
      })
      .promise();

    this.logger.log(`Deleted scheduler: ${schedulerId}`);
  }

  async updateHeartbeat(schedulerId: string): Promise<void> {
    const timestamp = new Date().toISOString();

    await this.dynamoDB
      .update({
        TableName: this.tableName,
        Key: { scheduler_id: schedulerId },
        UpdateExpression:
          'SET last_heartbeat = :timestamp, updated_at = :timestamp',
        ExpressionAttributeValues: {
          ':timestamp': timestamp,
        },
      })
      .promise();

    this.logger.debug(`Updated heartbeat for scheduler: ${schedulerId}`);
  }

  async findByStatus(status: string): Promise<Scheduler[]> {
    const result = await this.dynamoDB
      .scan({
        TableName: this.tableName,
        FilterExpression: '#status = :status',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': status,
        },
      })
      .promise();

    return (result.Items || []).map((item) => this.mapToEntity(item));
  }

  async findStaleSchedulers(timeoutMinutes: number): Promise<Scheduler[]> {
    const thresholdTime = new Date();
    thresholdTime.setMinutes(thresholdTime.getMinutes() - timeoutMinutes);

    const result = await this.dynamoDB
      .scan({
        TableName: this.tableName,
        FilterExpression:
          '#status = :running AND last_heartbeat < :threshold',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':running': SchedulerStatus.RUNNING,
          ':threshold': thresholdTime.toISOString(),
        },
      })
      .promise();

    return (result.Items || []).map((item) => this.mapToEntity(item));
  }

  async batchUpdate(
    updates: Array<{ id: string; data: Partial<Scheduler> }>,
  ): Promise<void> {
    // DynamoDB batch write has a limit of 25 items
    const chunks = this.chunkArray(updates, 25);

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map((update) => this.update(update.id, update.data)),
      );
    }

    this.logger.log(`Batch updated ${updates.length} schedulers`);
  }

  private mapToEntity(item: any): Scheduler {
    return new Scheduler({
      scheduler_id: item.scheduler_id,
      service_name: item.service_name,
      job_name: item.job_name,
      status: item.status,
      timestamp: new Date(item.timestamp),
      execution_time_ms: item.execution_time_ms,
      error_message: item.error_message,
      metadata: item.metadata,
      last_heartbeat: item.last_heartbeat
        ? new Date(item.last_heartbeat)
        : undefined,
      created_at: new Date(item.created_at),
      updated_at: new Date(item.updated_at),
      owner_email: item.owner_email,
      alert_user_id: item.alert_user_id,
    });
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}