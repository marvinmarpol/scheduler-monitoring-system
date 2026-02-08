export interface QueueMessage<T = any> {
  id: string;
  body: T;
  timestamp: Date;
  receiptHandle?: string;
}

export interface IQueueService {
  /**
   * Send a message to the queue
   */
  sendMessage<T>(message: T): Promise<void>;

  /**
   * Send multiple messages in batch
   */
  sendBatch<T>(messages: T[]): Promise<void>;

  /**
   * Receive messages from the queue
   */
  receiveMessages<T>(maxMessages?: number): Promise<QueueMessage<T>[]>;

  /**
   * Delete a message from the queue
   */
  deleteMessage(receiptHandle: string): Promise<void>;

  /**
   * Change message visibility timeout
   */
  changeVisibility(receiptHandle: string, timeoutSeconds: number): Promise<void>;
}

export const QUEUE_SERVICE = Symbol('IQueueService');