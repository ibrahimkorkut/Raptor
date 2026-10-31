import React from 'react';
import { Activity } from 'lucide-react';

interface SpeedGraphProps {
  currentSpeedBps: number;
  history: number[]; // Last 30 speed data points
}

export const SpeedGraph: React.FC<SpeedGraphProps> = ({ currentSpeedBps, history }) => {
  const maxSpeed = Math.max(...history, 1024 * 1024); // at least 1 MB/s scale

  const formatSpeed = (speedBps: number) => {
    if (speedBps <= 0) return '0 KB/s';
    if (speedBps < 1024 * 1024) {
      return `${(speedBps / 1024).toFixed(1)} KB/s`;
    }
    return `${(speedBps / (1024 * 1024)).toFixed(2)} MB/s`;
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex items-center space-x-4">
      <div className="flex items-center space-x-2 w-36">
        <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
        <div>
          <div className="text-[10px] text-slate-400 uppercase font-mono">Current Speed</div>
          <div className="text-xs font-bold font-mono text-emerald-400">
            {formatSpeed(currentSpeedBps)}
          </div>
        </div>
      </div>

      <div className="flex-1 h-8 flex items-end space-x-0.5 overflow-hidden">
        {history.map((val, idx) => {
          const heightPct = Math.min(100, Math.max(5, (val / maxSpeed) * 100));
          return (
            <div
              key={idx}
              className="flex-1 bg-emerald-500/30 hover:bg-emerald-400 rounded-t-sm transition-all"
              style={{ height: `${heightPct}%` }}
              title={formatSpeed(val)}
            />
          );
        })}
      </div>
    </div>
  );
};
