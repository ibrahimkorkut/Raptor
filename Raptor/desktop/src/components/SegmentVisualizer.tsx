import React from 'react';
import { SegmentInfo } from '../types';

interface SegmentVisualizerProps {
  totalBytes: number;
  segments: SegmentInfo[];
}

const COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-indigo-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-sky-500',
  'bg-lime-500',
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-yellow-500',
  'bg-red-500',
];

export const SegmentVisualizer: React.FC<SegmentVisualizerProps> = ({
  totalBytes,
  segments,
}) => {
  if (totalBytes <= 0 || !segments || segments.length === 0) {
    return (
      <div className="h-4 bg-slate-800 rounded-sm overflow-hidden border border-slate-700 relative">
        <div className="text-[10px] text-slate-500 text-center font-mono">
          Single stream or unknown length
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Segment Allocation ({segments.length} connections)</span>
        <span>Dynamic Bisection Active</span>
      </div>

      <div className="relative h-5 bg-slate-950 rounded border border-slate-700/80 overflow-hidden shadow-inner flex">
        {segments.map((seg, idx) => {
          const startPct = (seg.start / totalBytes) * 100;
          const currentPct = ((seg.current - seg.start) / totalBytes) * 100;
          const totalSegWidthPct = ((seg.end - seg.start) / totalBytes) * 100;
          const color = COLORS[idx % COLORS.length];

          return (
            <div
              key={seg.index}
              className="absolute top-0 bottom-0 border-r border-slate-800/80 overflow-hidden"
              style={{
                left: `${startPct}%`,
                width: `${totalSegWidthPct}%`,
              }}
              title={`Connection #${seg.index + 1}: ${((seg.current - seg.start) / (1024 * 1024)).toFixed(1)}MB / ${((seg.end - seg.start) / (1024 * 1024)).toFixed(1)}MB`}
            >
              {/* Completed portion of segment */}
              <div
                className={`h-full ${color} transition-all duration-300 relative`}
                style={{ width: `${Math.min(100, (currentPct / totalSegWidthPct) * 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/10 animate-pulse" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
