import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
import {
  IQueueService,
  QueueMessage,
} from '@/common/interfaces/queue-service.interface';

@Injectable()
export class SQSQueueService implements IQueueService {
  private readonly logger = new Logger(SQSQueueService.name);
  private readonly sqs: AWS.SQS;
  private readonly queueUrl: string;
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    this.queueUrl = this.configService.get<string>('SQS_QUEUE_URL') || '';
    this.enabled = this.configService.get<boolean>('SQS_ENABLED', false);

    this.sqs = new AWS.SQS({ region });

    if (this.enabled && !this.queueUrl) {
      this.logger.warn('SQS is enabled but queue URL is not configured');
    }
  }

  async sendMessage<T>(message: T): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('SQS is disabled, skipping message send');
      return;
    }

    const params: AWS.SQS.SendMessageRequest = {
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        Timestamp: {
          DataType: 'String',
          StringValue: new Date().toISOString(),
        },
      },
    };

    await this.sqs.sendMessage(params).promise();
    this.logger.debug('Message sent to SQS');
  }

  async sendBatch<T>(messages: T[]): Promise<void> {
    if (!this.enabled) {
      this.logger.debug('SQS is disabled, skipping batch send');
      return;
    }

    // SQS batch limit is 10 messages
    const chunks = this.chunkArray(messages, 10);

    for (const chunk of chunks) {
      const entries: AWS.SQS.SendMessageBatchRequestEntryList = chunk.map(
        (message, index) => ({
          Id: `${index}-${uuidv4()}`,
          MessageBody: JSON.stringify(message),
          MessageAttributes: {
            Timestamp: {
              DataType: 'String',
              StringValue: new Date().toISOString(),
            },
          },
        }),
      );

      const params: AWS.SQS.SendMessageBatchRequest = {
        QueueUrl: this.queueUrl,
        Entries: entries,
      };

      await this.sqs.sendMessageBatch(params).promise();
    }

    this.logger.debug(`Sent ${messages.length} messages to SQS in batches`);
  }

  async receiveMessages<T>(maxMessages: number = 10): Promise<QueueMessage<T>[]> {
    if (!this.enabled) {
      return [];
    }

    const params: AWS.SQS.ReceiveMessageRequest = {
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: Math.min(maxMessages, 10),
      WaitTimeSeconds: 10, // Long polling
      MessageAttributeNames: ['All'],
    };

    const result = await this.sqs.receiveMessage(params).promise();

    if (!result.Messages || result.Messages.length === 0) {
      return [];
    }

    return result.Messages.map((msg) => ({
      id: msg.MessageId || '',
      body: JSON.parse(msg.Body || '') as T,
      timestamp: new Date(
        msg.MessageAttributes?.Timestamp?.StringValue || new Date().toISOString(),
      ),
      receiptHandle: msg.ReceiptHandle,
    }));
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const params: AWS.SQS.DeleteMessageRequest = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    };

    await this.sqs.deleteMessage(params).promise();
    this.logger.debug('Message deleted from SQS');
  }

  async changeVisibility(
    receiptHandle: string,
    timeoutSeconds: number,
  ): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const params: AWS.SQS.ChangeMessageVisibilityRequest = {
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: timeoutSeconds,
    };

    await this.sqs.changeMessageVisibility(params).promise();
    this.logger.debug('Message visibility changed');
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}