export type DownloadStatus = 
  | 'Allocating'
  | 'Connecting'
  | 'Downloading'
  | 'Paused'
  | 'Queued'
  | 'Completed'
  | 'Failed';

export type FileCategory = 
  | 'All'
  | 'All files'
  | 'Archives'
  | 'Compressed'
  | 'Documents'
  | 'Music'
  | 'Programs'
  | 'Video'
  | 'Other'
  | 'General';

export type WorkspaceSection =
  | 'All downloads'
  | 'Downloading'
  | 'Queued'
  | 'Paused'
  | 'Completed'
  | 'Work files'
  | 'Personal'
  | 'Settings';

export type NavSection =
  | 'Downloads'
  | 'Active'
  | 'Queues'
  | 'Scheduler'
  | 'Completed'
  | 'Failed'
  | 'Settings';

export interface SegmentInfo {
  index: number;
  start: number;
  current: number;
  end: number;
  speedBps: number;
}

export interface DownloadTask {
  id: string;
  fileName: string;
  url: string;
  domain: string;
  totalBytes: number | null;
  downloadedBytes: number;
  status: DownloadStatus;
  activeConnections: number;
  currentSpeedBps: number;
  averageSpeedBps: number;
  etaSeconds: number | null;
  elapsedSeconds: number;
  category: FileCategory;
  collection?: 'Work files' | 'Personal';
  destinationPath: string;
  completedTime?: string;
  errorMessage?: string;
  createdAt: string;
  queueId?: string;
  segments?: SegmentInfo[];
}

export interface DownloadQueue {
  id: string;
  name: string;
  isRunning: boolean;
  maxConcurrent: number;
  downloadIds: string[];
}

export interface ScheduleRule {
  enabled: boolean;
  startTime: string;
  stopTime: string;
  daysOfWeek: number[];
  actionOnComplete: 'None' | 'HangUp' | 'Exit' | 'Shutdown';
}

export interface EngineStats {
  totalSpeedBps: number;
  activeDownloadsCount: number;
  maxSlots: number;
  downloadedSessionBytes: number;
  speedLimitBps: number | null;
}

export interface DiskInfo {
  drive: string;
  name: string;
  freeGB: number;
  totalGB: number;
  usedGB: number;
  usedPercent: number;
  label: string;
}

