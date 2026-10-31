import React from 'react';

interface StatsCardsProps {
  currentSpeedFormatted: string;
  activeSlots: number;
  totalSlots: number;
  downloadedSessionFormatted: string;
  totalSessionFiles: number;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  currentSpeedFormatted,
  activeSlots,
  totalSlots,
  downloadedSessionFormatted,
  totalSessionFiles,
}) => {
  return (
    <div className="grid grid-cols-3 gap-4 select-none">
      {/* Card 1: Download speed */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-[11px] font-medium text-gray-500">
            Download speed
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-bold text-gray-900 font-sans tracking-tight">
              {currentSpeedFormatted}
            </span>
            <span className="text-[10px] font-bold text-[#15803d] bg-[#dcfce7] px-1.5 py-0.5 rounded-md">
              Live
            </span>
          </div>
        </div>

        {/* Mini Green Sparkline Graph */}
        <div className="w-24 h-8 flex items-center justify-end">
          <svg viewBox="0 0 100 35" className="w-full h-full overflow-visible">
            <polyline
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points="0,28 15,24 30,26 45,18 60,20 75,10 90,14 100,6"
            />
          </svg>
        </div>
      </div>

      {/* Card 2: Active connections */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm space-y-1">
        <div className="text-[11px] font-medium text-gray-500">
          Active connections
        </div>
        <div className="text-xl font-bold text-gray-900 font-sans tracking-tight">
          {activeSlots} <span className="text-gray-400 font-normal">/</span> {totalSlots}
        </div>
        <div className="text-[11px] text-gray-400">
          {Math.max(0, totalSlots - activeSlots)} slot available
        </div>
      </div>

      {/* Card 3: Downloaded this session */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-4 shadow-sm space-y-1">
        <div className="text-[11px] font-medium text-gray-500">
          Downloaded this session
        </div>
        <div className="text-xl font-bold text-gray-900 font-sans tracking-tight">
          {downloadedSessionFormatted}
        </div>
        <div className="text-[11px] text-gray-400">
          Across {totalSessionFiles} files
        </div>
      </div>
    </div>
  );
};
