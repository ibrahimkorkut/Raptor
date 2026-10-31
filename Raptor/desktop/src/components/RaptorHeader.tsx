import React from 'react';
import { Search, Pause, Plus, LayoutGrid } from 'lucide-react';
import { WorkspaceSection } from '../types';

interface RaptorHeaderProps {
  currentSection: WorkspaceSection;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onPauseAll: () => void;
  onAddDownload: () => void;
  downloadingCount: number;
}

export const RaptorHeader: React.FC<RaptorHeaderProps> = ({
  currentSection,
  searchQuery,
  onSearchChange,
  onPauseAll,
  onAddDownload,
  downloadingCount,
}) => {
  return (
    <div className="space-y-4 pb-2 select-none">
      {/* Top Bar: Breadcrumb + Search */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center space-x-2 text-gray-600 font-medium">
          <LayoutGrid className="w-3.5 h-3.5 text-gray-400" />
          <span>Workspace</span>
          <span className="text-gray-300">/</span>
          <span className="text-gray-900 font-semibold">{currentSection}</span>
        </div>

        {/* Search Input */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search downloads"
            className="w-full bg-white border border-gray-200/80 rounded-xl pl-8 pr-10 py-1.5 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#1b4327] focus:ring-1 focus:ring-[#1b4327] transition shadow-sm"
          />
          <span className="absolute right-2.5 top-2 text-[10px] text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
            ⌘ K
          </span>
        </div>
      </div>

      {/* Main Title + Status Subtitle + Action Buttons */}
      <div className="flex items-end justify-between pt-1">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight font-sans">
            {currentSection}
          </h1>
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
            <span>
              {downloadingCount > 0 
                ? `${downloadingCount} in motion. Everything under control.` 
                : 'All tasks synced and idle.'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          {/* Pause all button */}
          <button
            onClick={onPauseAll}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 shadow-sm transition active:scale-95"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>Pause all</span>
          </button>

          {/* Add download button */}
          <button
            onClick={onAddDownload}
            className="flex items-center space-x-1.5 px-4 py-2 bg-[#1b4327] hover:bg-[#163720] text-white text-xs font-semibold rounded-xl shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add download</span>
          </button>
        </div>
      </div>
    </div>
  );
};
