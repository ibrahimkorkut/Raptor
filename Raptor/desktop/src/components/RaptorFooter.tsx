import React from 'react';
import { Trash2, Gauge, Folder, ExternalLink } from 'lucide-react';

interface RaptorFooterProps {
  totalCount: number;
  totalSizeFormatted: string;
  onClearCompleted: () => void;
  onOpenDownloadsFolder: () => void;
  speedLimitFormatted: string;
  onToggleSpeedLimit: () => void;
}

export const RaptorFooter: React.FC<RaptorFooterProps> = ({
  totalCount,
  totalSizeFormatted,
  onClearCompleted,
  onOpenDownloadsFolder,
  speedLimitFormatted,
  onToggleSpeedLimit,
}) => {
  return (
    <div className="space-y-3 pt-3 select-none text-xs">
      {/* Top Footer Summary Line */}
      <div className="flex items-center justify-between text-gray-500 font-mono text-[11px] px-1">
        <div>
          {totalCount} downloads · {totalSizeFormatted} total
        </div>
        <button
          onClick={onClearCompleted}
          className="flex items-center space-x-1.5 text-gray-500 hover:text-gray-900 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear completed</span>
        </button>
      </div>

      {/* Bottom Global Status Bar */}
      <div className="flex items-center justify-between py-2 px-1 border-t border-gray-200/80 text-[11px] text-gray-500">
        <div className="flex items-center space-x-4">
          {/* Connection status */}
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span className="text-gray-700 font-medium">Connected</span>
          </div>

          {/* Speed Limit */}
          <button
            onClick={onToggleSpeedLimit}
            className="flex items-center space-x-1.5 text-gray-500 hover:text-gray-900 transition"
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Speed limit: {speedLimitFormatted}</span>
          </button>
        </div>

        {/* Downloads Folder Location */}
        <button
          onClick={onOpenDownloadsFolder}
          className="flex items-center space-x-1 text-gray-500 hover:text-[#1b4327] transition font-mono"
        >
          <Folder className="w-3.5 h-3.5" />
          <span>Saving to ~/Downloads</span>
          <ExternalLink className="w-3 h-3 text-gray-400" />
        </button>
      </div>
    </div>
  );
};
