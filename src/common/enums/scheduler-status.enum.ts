export enum SchedulerStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum AlertType {
  FAILED_JOB = 'failed_job',
  TIMEOUT = 'timeout',
  ALL_CLEAR = 'all_clear',
}

export const STATUS_EMOJI: Record<SchedulerStatus, string> = {
  [SchedulerStatus.PENDING]: '⬜',
  [SchedulerStatus.RUNNING]: '🟡',
  [SchedulerStatus.COMPLETED]: '✅',
  [SchedulerStatus.FAILED]: '❌',
};
