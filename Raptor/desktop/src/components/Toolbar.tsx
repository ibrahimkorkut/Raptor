import React from 'react';
import { 
  Plus, 
  Play, 
  Pause, 
  Square, 
  Trash2, 
  Gauge, 
  Settings,
  RotateCw,
  XCircle
} from 'lucide-react';

interface ToolbarProps {
  onAddDownload: () => void;
  onResume: () => void;
  onPause: () => void;
  onStopAll: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onDelete: () => void;
  speedLimitEnabled: boolean;
  onToggleSpeedLimit: () => void;
  speedLimitKbps: number;
  onChangeSpeedLimit: (kbps: number) => void;
  onOpenSettings: () => void;
  hasSelection: boolean;
  selectedStatus?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onAddDownload,
  onResume,
  onPause,
  onStopAll,
  onCancel,
  onRetry,
  onDelete,
  speedLimitEnabled,
  onToggleSpeedLimit,
  speedLimitKbps,
  onChangeSpeedLimit,
  onOpenSettings,
  hasSelection,
  selectedStatus,
}) => {
  return (
    <div className="bg-slate-950 border-b border-slate-800 px-4 py-2 flex items-center justify-between select-none">
      <div className="flex items-center space-x-2">
        <button
          onClick={onAddDownload}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-600/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add URL</span>
        </button>

        <div className="h-6 w-px bg-slate-800 mx-1" />

        <button
          onClick={onResume}
          className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
          title={hasSelection ? "Resume Selected Download" : "Resume All Paused Downloads"}
        >
          <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
          <span>Resume</span>
        </button>

        <button
          onClick={onPause}
          className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
          title={hasSelection ? "Pause Selected Download" : "Pause All Active Downloads"}
        >
          <Pause className="w-3.5 h-3.5 text-amber-400" />
          <span>Pause</span>
        </button>

        <button
          onClick={onStopAll}
          className="flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
          title="Stop All Downloads"
        >
          <Square className="w-3.5 h-3.5 fill-current text-rose-400" />
          <span>Stop All</span>
        </button>

        <button
          onClick={onCancel}
          disabled={!hasSelection || selectedStatus !== 'Downloading'}
          className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
            hasSelection && selectedStatus === 'Downloading'
              ? 'bg-slate-800 hover:bg-slate-700 text-rose-300' 
              : 'bg-slate-900/60 text-slate-600 cursor-not-allowed'
          }`}
          title="Cancel Download"
        >
          <XCircle className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>

        <button
          onClick={onRetry}
          disabled={!hasSelection && selectedStatus !== 'Failed'}
          className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
            hasSelection 
              ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300' 
              : 'bg-slate-900/60 text-slate-600 cursor-not-allowed'
          }`}
          title="Retry Download"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>

        <button
          onClick={onDelete}
          disabled={!hasSelection}
          className={`flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition ${
            hasSelection 
              ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border border-rose-800/40' 
              : 'bg-slate-900/60 text-slate-600 cursor-not-allowed'
          }`}
          title="Delete Download Entry"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>

      {/* Right side: Speed Limiter & Settings */}
      <div className="flex items-center space-x-3 text-xs">
        {/* Speed Limiter toggle & input */}
        <div className="flex items-center space-x-2 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
          <button
            onClick={onToggleSpeedLimit}
            className={`flex items-center space-x-1.5 transition ${
              speedLimitEnabled ? 'text-amber-400 font-semibold' : 'text-slate-500 hover:text-slate-300'
            }`}
            title="Toggle Speed Limiter"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Speed Limit:</span>
            <span className="font-mono">{speedLimitEnabled ? 'ON' : 'OFF'}</span>
          </button>

          {speedLimitEnabled && (
            <div className="flex items-center space-x-1 border-l border-slate-700 pl-2">
              <input
                type="number"
                min={100}
                step={500}
                value={speedLimitKbps}
                onChange={(e) => onChangeSpeedLimit(Math.max(100, parseInt(e.target.value) || 100))}
                className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right font-mono text-xs text-amber-300 focus:outline-none focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-500 font-mono">KB/s</span>
            </div>
          )}
        </div>

        {/* Global Settings Modal Trigger */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
          title="Engine & Network Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
