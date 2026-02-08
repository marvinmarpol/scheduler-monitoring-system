import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import { IStatusHistoryRepository } from '@/common/interfaces/status-history-repository.interface';
import { StatusHistory } from '@/common/entities/status-history.entity';

@Injectable()
export class DynamoDBStatusHistoryRepository
  implements IStatusHistoryRepository
{
  private readonly logger = new Logger(DynamoDBStatusHistoryRepository.name);
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
    this.tableName = this.configService.get<string>('DYNAMODB_TABLE_STATUS_HISTORY') || '';
  }

  async create(statusHistory: StatusHistory): Promise<StatusHistory> {
    const item = {
      id: uuidv4(),
      scheduler_id: statusHistory.scheduler_id,
      status: statusHistory.status,
      timestamp: statusHistory.timestamp.toISOString(),
      execution_time_ms: statusHistory.execution_time_ms,
      error_message: statusHistory.error_message,
      metadata: statusHistory.metadata,
    };

    await this.dynamoDB
      .put({
        TableName: this.tableName,
        Item: item,
      })
      .promise();

    this.logger.debug(
      `Created status history for scheduler: ${statusHistory.scheduler_id}`,
    );
    return this.mapToEntity(item);
  }

  async findBySchedulerId(
    schedulerId: string,
    limit: number = 50,
  ): Promise<StatusHistory[]> {
    const result = await this.dynamoDB
      .query({
        TableName: this.tableName,
        KeyConditionExpression: 'scheduler_id = :scheduler_id',
        ExpressionAttributeValues: {
          ':scheduler_id': schedulerId,
        },
        ScanIndexForward: false, // Sort by timestamp descending
        Limit: limit,
      })
      .promise();

    return (result.Items || []).map((item) => this.mapToEntity(item));
  }

  async findByDateRange(
    schedulerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StatusHistory[]> {
    const result = await this.dynamoDB
      .query({
        TableName: this.tableName,
        KeyConditionExpression:
          'scheduler_id = :scheduler_id AND #timestamp BETWEEN :start AND :end',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':scheduler_id': schedulerId,
          ':start': startDate.toISOString(),
          ':end': endDate.toISOString(),
        },
        ScanIndexForward: false,
      })
      .promise();

    return (result.Items || []).map((item) => this.mapToEntity(item));
  }

  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.dynamoDB
      .scan({
        TableName: this.tableName,
        FilterExpression: '#timestamp < :date',
        ExpressionAttributeNames: {
          '#timestamp': 'timestamp',
        },
        ExpressionAttributeValues: {
          ':date': date.toISOString(),
        },
      })
      .promise();

    const items = result.Items || [];
    let deletedCount = 0;

    // Delete in batches of 25 (DynamoDB limit)
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25);
      const deleteRequests = batch.map((item) => ({
        DeleteRequest: {
          Key: {
            id: item.id,
            scheduler_id: item.scheduler_id,
          },
        },
      }));

      await this.dynamoDB
        .batchWrite({
          RequestItems: {
            [this.tableName]: deleteRequests,
          },
        })
        .promise();

      deletedCount += batch.length;
    }

    this.logger.log(`Deleted ${deletedCount} old status history entries`);
    return deletedCount;
  }

  private mapToEntity(item: any): StatusHistory {
    return new StatusHistory({
      id: item.id,
      scheduler_id: item.scheduler_id,
      status: item.status,
      timestamp: new Date(item.timestamp),
      execution_time_ms: item.execution_time_ms,
      error_message: item.error_message,
      metadata: item.metadata,
    });
  }
}