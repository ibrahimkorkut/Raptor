import React from 'react';
import { ArrowUpDown, Trash2, Pause, Play, X } from 'lucide-react';
import { FileCategory } from '../types';

interface FilterTabsProps {
  currentCategory: FileCategory;
  onSelectCategory: (cat: FileCategory) => void;
  sortBy: string;
  onToggleSort: () => void;
  selectedCount?: number;
  onBatchDelete?: () => void;
  onBatchPause?: () => void;
  onBatchResume?: () => void;
  onClearSelection?: () => void;
  hasActiveDownloads?: boolean;
  hasPausedDownloads?: boolean;
}

export const FilterTabs: React.FC<FilterTabsProps> = ({
  currentCategory,
  onSelectCategory,
  sortBy,
  onToggleSort,
  selectedCount = 0,
  onBatchDelete,
  onBatchPause,
  onBatchResume,
  onClearSelection,
  hasActiveDownloads = false,
  hasPausedDownloads = false,
}) => {
  const categories: FileCategory[] = [
    'All files',
    'Archives',
    'Video',
    'Documents',
    'Other'
  ];

  return (
    <div className="flex items-center justify-between pt-2 pb-1 select-none min-h-[42px]">
      {/* Category Pills */}
      <div className="flex items-center space-x-1.5">
        {categories.map((cat) => {
          const isActive = currentCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => onSelectCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-[#dcfce7] text-[#15803d]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/80'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Right Side: Batch Actions Toolbar or Sort Button */}
      {selectedCount > 0 ? (
        <div className="flex items-center space-x-2 animate-in fade-in slide-in-from-right-3 duration-200">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-100/90 text-emerald-900 border border-emerald-300/80 rounded-xl text-xs font-bold shadow-xs">
            <span>{selectedCount} dosya seçildi</span>
          </div>

          {hasActiveDownloads && onBatchPause && (
            <button
              onClick={onBatchPause}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-700 hover:text-amber-800 text-xs font-semibold rounded-xl border border-amber-200 shadow-sm transition"
              title="Seçilenleri Duraklat"
            >
              <Pause className="w-3.5 h-3.5 text-amber-600" />
              <span>Duraklat</span>
            </button>
          )}

          {hasPausedDownloads && onBatchResume && (
            <button
              onClick={onBatchResume}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 shadow-sm transition"
              title="Seçilenleri Başlat / Devam Ettir"
            >
              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              <span>Devam Et</span>
            </button>
          )}

          {onBatchDelete && (
            <button
              onClick={onBatchDelete}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition"
              title="Seçilenleri Listeden veya Diskten Sil"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Toplu Sil ({selectedCount})</span>
            </button>
          )}

          {onClearSelection && (
            <button
              onClick={onClearSelection}
              className="p-1.5 bg-white hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl border border-gray-200 transition"
              title="Seçimi Kaldır"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        /* Sort Dropdown / Button */
        <button
          onClick={onToggleSort}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 shadow-sm transition"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
          <span>{sortBy}</span>
        </button>
      )}
    </div>
  );
};
