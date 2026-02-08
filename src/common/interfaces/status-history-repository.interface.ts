import { StatusHistory } from '@/common/entities/status-history.entity';

export interface IStatusHistoryRepository {
  /**
   * Create a new status history entry
   */
  create(statusHistory: StatusHistory): Promise<StatusHistory>;

  /**
   * Find history by scheduler ID
   */
  findBySchedulerId(
    schedulerId: string,
    limit?: number,
  ): Promise<StatusHistory[]>;

  /**
   * Find history within date range
   */
  findByDateRange(
    schedulerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StatusHistory[]>;

  /**
   * Delete old history entries (cleanup)
   */
  deleteOlderThan(date: Date): Promise<number>;
}

export const STATUS_HISTORY_REPOSITORY = Symbol('IStatusHistoryRepository');