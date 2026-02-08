import { Scheduler } from '@/common/entities/scheduler.entity';

export interface ISchedulerRepository {
  /**
   * Create a new scheduler
   */
  create(scheduler: Scheduler): Promise<Scheduler>;

  /**
   * Find scheduler by ID
   */
  findById(schedulerId: string): Promise<Scheduler | null>;

  /**
   * Find all schedulers
   */
  findAll(): Promise<Scheduler[]>;

  /**
   * Update scheduler
   */
  update(schedulerId: string, updates: Partial<Scheduler>): Promise<Scheduler>;

  /**
   * Delete scheduler
   */
  delete(schedulerId: string): Promise<void>;

  /**
   * Update heartbeat timestamp
   */
  updateHeartbeat(schedulerId: string): Promise<void>;

  /**
   * Find schedulers by status
   */
  findByStatus(status: string): Promise<Scheduler[]>;

  /**
   * Find stale schedulers (no heartbeat within threshold)
   */
  findStaleSchedulers(timeoutMinutes: number): Promise<Scheduler[]>;

  /**
   * Batch update schedulers
   */
  batchUpdate(
    updates: Array<{ id: string; data: Partial<Scheduler> }>,
  ): Promise<void>;
}

export const SCHEDULER_REPOSITORY = Symbol('ISchedulerRepository');
