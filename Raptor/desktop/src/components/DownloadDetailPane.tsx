import React from 'react';
import { 
  X, 
  Folder, 
  Play, 
  Pause, 
  RotateCw,
  Copy,
  Check
} from 'lucide-react';
import { DownloadTask } from '../types';
import { SegmentVisualizer } from './SegmentVisualizer';
import { SpeedGraph } from './SpeedGraph';

interface DownloadDetailPaneProps {
  task: DownloadTask;
  speedHistory: number[];
  onClose: () => void;
  onResume: (id: string) => void;
  onPause: (id: string) => void;
  onRetry: (id: string) => void;
  onOpenFolder: (path: string) => void;
}

export const DownloadDetailPane: React.FC<DownloadDetailPaneProps> = ({
  task,
  speedHistory,
  onClose,
  onResume,
  onPause,
  onRetry,
  onOpenFolder,
}) => {
  const [copied, setCopied] = React.useState(false);

  const formatBytes = (bytes: number | null) => {
    if (bytes === null || bytes === 0) return 'Unknown';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (speedBps: number) => {
    if (speedBps <= 0) return '0 KB/s';
    if (speedBps < 1024 * 1024) {
      return `${(speedBps / 1024).toFixed(1)} KB/s`;
    }
    return `${(speedBps / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  const formatSeconds = (secs: number | null) => {
    if (secs === null || secs <= 0) return '-';
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) {
      const mins = Math.floor(secs / 60);
      const s = secs % 60;
      return `${mins}m ${s}s`;
    }
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(task.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 border-t border-slate-800 p-4 space-y-3.5 select-none animate-in slide-in-from-bottom-2 duration-150">
      {/* Top Bar with Title and Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 truncate">
          <div className="font-bold text-sm text-slate-100 truncate max-w-md">
            {task.fileName}
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
            task.status === 'Downloading' 
              ? 'bg-blue-950 text-blue-300 border border-blue-700/60' 
              : task.status === 'Completed'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                : 'bg-slate-800 text-slate-300'
          }`}>
            {task.status.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {task.status === 'Downloading' ? (
            <button
              onClick={() => onPause(task.id)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30 rounded text-xs font-medium transition"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
          ) : task.status === 'Failed' ? (
            <button
              onClick={() => onRetry(task.id)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-cyan-600/20 text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30 rounded text-xs font-medium transition"
            >
              <RotateCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          ) : task.status !== 'Completed' ? (
            <button
              onClick={() => onResume(task.id)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-xs font-medium transition"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Resume</span>
            </button>
          ) : null}

          <button
            onClick={() => onOpenFolder(task.destinationPath)}
            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-medium transition"
          >
            <Folder className="w-3 h-3" />
            <span>Open Folder</span>
          </button>

          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded transition"
            title="Close Details Pane"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metadata Detail Grid */}
      <div className="grid grid-cols-4 gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        <div>
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Download URL</span>
          <div className="flex items-center space-x-1.5 mt-0.5">
            <span className="font-mono text-slate-300 truncate max-w-[200px]" title={task.url}>
              {task.url}
            </span>
            <button
              onClick={handleCopyUrl}
              className="p-0.5 text-slate-500 hover:text-white rounded"
              title="Copy URL"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Transferred & Size</span>
          <span className="font-mono font-semibold text-slate-200 mt-0.5 block">
            {formatBytes(task.downloadedBytes)} / {formatBytes(task.totalBytes)}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Current / Average Speed</span>
          <div className="flex items-center space-x-1 mt-0.5 font-mono">
            <span className="text-emerald-400 font-semibold">{formatSpeed(task.currentSpeedBps)}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">{formatSpeed(task.averageSpeedBps)}</span>
          </div>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 uppercase font-mono block">Active Streams / ETA</span>
          <div className="flex items-center space-x-2 mt-0.5 font-mono">
            <span className="text-blue-400 font-semibold">{task.activeConnections} conns</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">{formatSeconds(task.etaSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Dynamic Segment Progress Bar */}
      <SegmentVisualizer
        totalBytes={task.totalBytes || 0}
        segments={task.segments || []}
      />

      {/* Live Speed Graph Timeline */}
      <SpeedGraph
        currentSpeedBps={task.currentSpeedBps}
        history={speedHistory}
      />
    </div>
  );
};
