import React, { useState } from 'react';
import { 
  Play, 
  Pause, 
  Folder, 
  MoreHorizontal, 
  CheckCircle2, 
  AlertCircle,
  Clock, 
  ChevronDown, 
  ChevronRight,
  Disc,
  FileArchive,
  Film,
  FileText,
  FileCode,
  File,
  Copy,
  Trash2,
  RotateCcw,
  Plus,
  FolderOpen
} from 'lucide-react';
import { DownloadTask } from '../types';
import { RaptorPixelHead } from './RaptorPixelHead';

interface RaptorDownloadListProps {
  tasks: DownloadTask[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onOpenFolder: (path: string) => void;
  onOpenFile?: (path: string) => void;
  onDelete: (id: string) => void;
  onAddNewDownload?: () => void;
  onPauseAll?: () => void;
  onClearCompleted?: () => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onPromptBatchDelete?: () => void;
}

export const RaptorDownloadList: React.FC<RaptorDownloadListProps> = ({
  tasks,
  onPause,
  onResume,
  onOpenFolder,
  onOpenFile,
  onDelete,
  onAddNewDownload,
  onPauseAll,
  onClearCompleted,
  selectedIds: selectedIdsProp,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onPromptBatchDelete,
}) => {
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = selectedIdsProp !== undefined ? selectedIdsProp : internalSelectedIds;
  const [inProgressOpen, setInProgressOpen] = useState(true);
  const [queuedOpen, setQueuedOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);
  const [failedOpen, setFailedOpen] = useState(true);
  const [activeMenu, setActiveMenu] = useState<{
    task: DownloadTask;
    x: number;
    y: number;
    openUpward: boolean;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    task: DownloadTask;
    x: number;
    y: number;
  } | null>(null);
  const [globalMenu, setGlobalMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleRowContextMenu = (e: React.MouseEvent, task: DownloadTask) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenu(null);
    setGlobalMenu(null);
    const menuHeight = 270;
    const menuWidth = 200;
    const y = e.clientY + menuHeight > window.innerHeight ? e.clientY - menuHeight : e.clientY;
    const x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX;
    setContextMenu({
      task,
      x: Math.max(10, x),
      y: Math.max(10, y),
    });
  };

  const handleContainerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setActiveMenu(null);
    setContextMenu(null);
    const menuHeight = 220;
    const menuWidth = 220;
    const y = e.clientY + menuHeight > window.innerHeight ? e.clientY - menuHeight : e.clientY;
    const x = e.clientX + menuWidth > window.innerWidth ? e.clientX - menuWidth : e.clientX;
    setGlobalMenu({
      x: Math.max(10, x),
      y: Math.max(10, y),
    });
  };

  const handleOpenRowMenu = (e: React.MouseEvent, task: DownloadTask) => {
    e.stopPropagation();
    if (activeMenu?.task.id === task.id) {
      setActiveMenu(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 210;

    setActiveMenu({
      task,
      x: rect.right,
      y: openUpward ? rect.top - 4 : rect.bottom + 4,
      openUpward,
    });
  };

  const toggleSelect = (id: string) => {
    if (onToggleSelect) {
      onToggleSelect(id);
    } else {
      setInternalSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  };

  const handleMasterCheckbox = () => {
    if (selectedIds.size === tasks.length) {
      if (onClearSelection) onClearSelection();
      else setInternalSelectedIds(new Set());
    } else {
      if (onSelectAll) onSelectAll();
      else setInternalSelectedIds(new Set(tasks.map((t) => t.id)));
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'iso' || ext === 'img') return <Disc className="w-4 h-4 text-gray-700" />;
    if (['zip', 'rar', '7z', 'tar', 'gz', 'dmg'].includes(ext || '')) return <FileArchive className="w-4 h-4 text-gray-700" />;
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext || '')) return <Film className="w-4 h-4 text-gray-700" />;
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText className="w-4 h-4 text-gray-700" />;
    if (['exe', 'msi', 'apk'].includes(ext || '')) return <FileCode className="w-4 h-4 text-gray-700" />;
    return <File className="w-4 h-4 text-gray-700" />;
  };

  const inProgressTasks = tasks.filter((t) => t.status === 'Downloading' || t.status === 'Paused');
  const queuedTasks = tasks.filter((t) => t.status === 'Queued');
  const completedTasks = tasks.filter((t) => t.status === 'Completed');
  const failedTasks = tasks.filter((t) => t.status === 'Failed' || t.status.startsWith('Failed'));

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const formatSpeed = (bps: number) => {
    if (bps <= 0) return '—';
    if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`;
    return `${(bps / 1024).toFixed(0)} KB/s`;
  };

  const formatEta = (secs: number | null) => {
    if (secs === null || secs <= 0) return '—';
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div 
      className="bg-white border border-gray-200/80 rounded-2xl shadow-sm select-none"
      onContextMenu={handleContainerContextMenu}
    >
      {/* Table Column Headers */}
      <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 border-b text-[11px] font-medium rounded-t-2xl transition duration-150 ${
        selectedIds.size > 0 
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950 font-semibold' 
          : 'bg-gray-50/60 border-gray-200/80 text-gray-400'
      }`}>
        <div className="col-span-5 flex items-center space-x-3">
          <input 
            type="checkbox" 
            className="rounded border-gray-300 text-[#1b4327] focus:ring-0 w-3.5 h-3.5 cursor-pointer"
            checked={tasks.length > 0 && selectedIds.size === tasks.length}
            onChange={handleMasterCheckbox}
          />
          {selectedIds.size > 0 ? (
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-emerald-900 font-bold">
                {selectedIds.size} / {tasks.length} dosya seçildi
              </span>
              <button
                onClick={() => {
                  if (onClearSelection) onClearSelection();
                  else setInternalSelectedIds(new Set());
                }}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 underline font-normal cursor-pointer"
              >
                Seçimi Temizle
              </button>
            </div>
          ) : (
            <span>Dosya Adı (File name)</span>
          )}
        </div>
        <div className="col-span-3">Durum / İlerleme</div>
        <div className="col-span-2 text-right">Hız / Boyut</div>
        <div className="col-span-1 text-center">Kalan Süre</div>
        <div className="col-span-1 text-right">
          {selectedIds.size > 0 && onPromptBatchDelete ? (
            <button
              onClick={onPromptBatchDelete}
              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-bold shadow-xs transition"
            >
              Sil ({selectedIds.size})
            </button>
          ) : (
            <span>İşlemler</span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100 font-sans text-xs">
        {/* GROUP 1: In Progress */}
        {inProgressTasks.length > 0 && (
          <div>
            {/* Group Header */}
            <div 
              onClick={() => setInProgressOpen(!inProgressOpen)}
              className="flex items-center justify-between px-4 py-2 bg-gray-50/40 hover:bg-gray-50 cursor-pointer text-xs font-semibold text-gray-700"
            >
              <div className="flex items-center space-x-2">
                {inProgressOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                <span>In progress</span>
                <span className="text-gray-400 font-normal">{inProgressTasks.length}</span>
              </div>
              <div className="text-[11px] font-normal text-gray-400 flex items-center space-x-1">
                <span>{inProgressTasks.filter(t => t.status === 'Downloading').length} downloading</span>
                <span>·</span>
                <span>{inProgressTasks.filter(t => t.status === 'Paused').length} paused</span>
              </div>
            </div>

            {/* In Progress Rows */}
            {inProgressOpen && inProgressTasks.map((task) => {
              const isSelected = selectedIds.has(task.id);
              const progressPct = task.totalBytes
                ? Math.min(100, Math.round((task.downloadedBytes / task.totalBytes) * 100))
                : 0;

              return (
                <div
                  key={task.id}
                  onDoubleClick={() => onOpenFolder(task.destinationPath)}
                  onContextMenu={(e) => handleRowContextMenu(e, task)}
                  className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50/60 transition ${
                    isSelected ? 'bg-emerald-50/40' : ''
                  }`}
                >
                  {/* File Name & Domain */}
                  <div className="col-span-5 flex items-center space-x-3 truncate">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(task.id)}
                      className="rounded border-gray-300 text-[#1b4327] focus:ring-0 w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                      {getFileIcon(task.fileName)}
                    </div>
                    <div className="truncate space-y-0.5">
                      <div className="font-semibold text-gray-900 truncate" title={task.fileName}>
                        {task.fileName}
                      </div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {task.domain} · {formatSize(task.totalBytes)}
                      </div>
                    </div>
                  </div>

                  {/* Status / Progress Bar */}
                  <div className="col-span-3 space-y-1 pr-4">
                    <div className="flex justify-between text-[11px] text-gray-500 font-mono">
                      <span>{task.status === 'Paused' ? 'Paused' : `${formatSize(task.downloadedBytes)} / ${formatSize(task.totalBytes)}`}</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          task.status === 'Paused' ? 'bg-gray-400' : 'bg-[#1b4327]'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Speed / Size */}
                  <div className="col-span-2 text-right">
                    <div className="font-mono font-semibold text-emerald-800 text-xs">
                      {task.status === 'Paused' ? 'Duraklatıldı' : formatSpeed(task.currentSpeedBps)}
                    </div>
                    <div className="text-[11px] font-mono text-gray-400 mt-0.5">
                      {formatSize(task.downloadedBytes)} / {formatSize(task.totalBytes)}
                    </div>
                  </div>

                  {/* Time left */}
                  <div className="col-span-1 text-center text-[11px] text-gray-500 font-mono">
                    {task.status === 'Paused' ? 'Paused' : formatEta(task.etaSeconds)}
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 flex items-center justify-end space-x-1 relative">
                    {task.status === 'Downloading' ? (
                      <button
                        onClick={() => onPause(task.id)}
                        className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                        title="Pause"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onResume(task.id)}
                        className="p-1 text-[#15803d] hover:bg-emerald-50 rounded-lg transition"
                        title="Resume"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleOpenRowMenu(e, task)}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                      title="Seçenekler"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* GROUP 2: Queued */}
        {queuedTasks.length > 0 && (
          <div>
            <div 
              onClick={() => setQueuedOpen(!queuedOpen)}
              className="flex items-center justify-between px-4 py-2 bg-gray-50/40 hover:bg-gray-50 cursor-pointer text-xs font-semibold text-gray-700"
            >
              <div className="flex items-center space-x-2">
                {queuedOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                <span>Queued</span>
                <span className="text-gray-400 font-normal">{queuedTasks.length}</span>
              </div>
              <div className="text-[11px] font-normal text-gray-400">
                ⚙ Auto-start on · Manage queue
              </div>
            </div>

            {queuedOpen && queuedTasks.map((task, idx) => (
              <div
                key={task.id}
                onDoubleClick={() => onOpenFolder(task.destinationPath)}
                onContextMenu={(e) => handleRowContextMenu(e, task)}
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50/60 transition"
              >
                <div className="col-span-5 flex items-center space-x-3 truncate">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    className="rounded border-gray-300 text-[#1b4327] focus:ring-0 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(task.fileName)}
                  </div>
                  <div className="truncate space-y-0.5">
                    <div className="font-semibold text-gray-900 truncate" title={task.fileName}>
                      {task.fileName}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {task.domain} · {formatSize(task.totalBytes)}
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex items-center space-x-1.5 text-[11px] text-gray-500">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Waiting for a slot</span>
                </div>

                <div className="col-span-2 text-right">
                  <div className="font-mono font-semibold text-gray-600 text-xs">
                    {formatSize(task.totalBytes)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Sırada Bekliyor
                  </div>
                </div>

                <div className="col-span-1 text-center text-[11px] text-gray-500 font-mono">
                  {idx === 0 ? 'Up next' : 'In queue'}
                </div>

                <div className="col-span-1 flex items-center justify-end space-x-1 relative">
                  <button
                    onClick={() => onResume(task.id)}
                    className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                    title="Start Now"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <button
                    onClick={(e) => handleOpenRowMenu(e, task)}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    title="Seçenekler"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GROUP 3: Completed */}
        {completedTasks.length > 0 && (
          <div>
            <div 
              onClick={() => setCompletedOpen(!completedOpen)}
              className="flex items-center justify-between px-4 py-2 bg-gray-50/40 hover:bg-gray-50 cursor-pointer text-xs font-semibold text-gray-700"
            >
              <div className="flex items-center space-x-2">
                {completedOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                <span>Completed</span>
                <span className="text-gray-400 font-normal">{completedTasks.length}</span>
              </div>
              <div className="text-[11px] font-normal text-gray-400">
                📅 Today, October 31
              </div>
            </div>

            {completedOpen && completedTasks.map((task) => (
              <div
                key={task.id}
                onDoubleClick={() => onOpenFile ? onOpenFile(task.destinationPath) : onOpenFolder(task.destinationPath)}
                onContextMenu={(e) => handleRowContextMenu(e, task)}
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50/60 transition cursor-pointer"
              >
                <div className="col-span-5 flex items-center space-x-3 truncate">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    className="rounded border-gray-300 text-[#1b4327] focus:ring-0 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    {getFileIcon(task.fileName)}
                  </div>
                  <div className="truncate space-y-0.5">
                    <div className="font-semibold text-gray-900 truncate" title={task.fileName}>
                      {task.fileName}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {task.domain} · {formatSize(task.totalBytes)}
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex items-center space-x-1.5 text-[11px] font-semibold text-[#15803d]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completed</span>
                </div>

                <div className="col-span-2 text-right">
                  <div className="font-mono font-semibold text-gray-900 text-xs">
                    {formatSize(task.totalBytes)}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                    Tamamlandı
                  </div>
                </div>

                <div className="col-span-1 text-center text-[11px] text-gray-400 font-mono">
                  {task.completedTime || '10:30 AM'}
                </div>

                <div className="col-span-1 flex items-center justify-end space-x-1 relative">
                  <button
                    onClick={() => onOpenFolder(task.destinationPath)}
                    className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                    title="Klasörü Aç"
                  >
                    <Folder className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleOpenRowMenu(e, task)}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    title="Seçenekler"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* GROUP 4: Failed */}
        {failedTasks.length > 0 && (
          <div>
            <div 
              onClick={() => setFailedOpen(!failedOpen)}
              className="flex items-center justify-between px-4 py-2 bg-rose-50/50 hover:bg-rose-50 cursor-pointer text-xs font-semibold text-rose-800"
            >
              <div className="flex items-center space-x-2">
                {failedOpen ? <ChevronDown className="w-3.5 h-3.5 text-rose-500" /> : <ChevronRight className="w-3.5 h-3.5 text-rose-500" />}
                <span className="flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                  <span>Hata Oluşan İndirmeler</span>
                </span>
                <span className="text-rose-600 bg-rose-100/80 px-1.5 py-0.5 rounded-full text-[10px] font-bold">{failedTasks.length}</span>
              </div>
              <div className="text-[11px] font-normal text-rose-500">
                {failedTasks.length} başarısız işlem
              </div>
            </div>

            {failedOpen && failedTasks.map((task) => (
              <div
                key={task.id}
                onDoubleClick={() => onOpenFolder(task.destinationPath)}
                onContextMenu={(e) => handleRowContextMenu(e, task)}
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-rose-50/30 transition"
              >
                <div className="col-span-5 flex items-center space-x-3 truncate">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => toggleSelect(task.id)}
                    className="rounded border-gray-300 text-rose-600 focus:ring-0 w-3.5 h-3.5 flex-shrink-0"
                  />
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0 border border-rose-100">
                    {getFileIcon(task.fileName)}
                  </div>
                  <div className="truncate space-y-0.5">
                    <div className="font-semibold text-gray-900 truncate" title={task.fileName}>
                      {task.fileName}
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      {task.domain} · {formatSize(task.totalBytes || task.downloadedBytes)}
                    </div>
                  </div>
                </div>

                <div className="col-span-3 flex items-center space-x-1.5 text-[11px] font-medium text-rose-600 truncate">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-rose-500" />
                  <span className="truncate" title={task.errorMessage || 'İndirme hatası'}>
                    {task.errorMessage || 'Hata oluştu'}
                  </span>
                </div>

                <div className="col-span-2 text-right">
                  <div className="font-mono font-semibold text-rose-600 text-xs">
                    {formatSize(task.downloadedBytes || task.totalBytes)}
                  </div>
                  <div className="text-[10px] text-rose-400 mt-0.5">
                    Başarısız
                  </div>
                </div>

                <div className="col-span-1 text-center text-[11px] text-rose-400 font-mono">
                  Hata
                </div>

                <div className="col-span-1 flex items-center justify-end space-x-1 relative">
                  <button
                    onClick={() => onResume(task.id)}
                    className="p-1 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                    title="Yeniden Dene"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onOpenFolder(task.destinationPath)}
                    className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                    title="Klasör"
                  >
                    <Folder className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => handleOpenRowMenu(e, task)}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    title="Seçenekler"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      {tasks.length === 0 && (
        <div className="py-20 text-center text-gray-400 space-y-3 select-none">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-[#111612] flex items-center justify-center shadow-md border border-[#1c261e] hover:border-emerald-500/40 transition duration-300">
            <RaptorPixelHead className="w-10 h-8" color="#a3e635" eyeColor="#111612" />
          </div>
          <div className="text-sm font-semibold text-gray-800">Henüz aktif veya kayıtlı indirme yok</div>
          <div className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
            Yukarıdaki "+ New download" butonuna tıklayarak veya tarayıcınızdan bir dosya / video bağlantısı ekleyerek yüksek hızlı indirme başlatabilirsiniz.
          </div>
        </div>
      )}
      </div>

      {/* Global Canvas Context Menu */}
      {globalMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setGlobalMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setGlobalMenu(null);
            }}
          />
          <div
            className="fixed z-50 w-52 bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-xl shadow-2xl py-1.5 text-xs font-medium text-gray-700 select-none animate-in fade-in zoom-in-95 duration-100"
            style={{ top: `${globalMenu.y}px`, left: `${globalMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1 text-[11px] font-semibold text-emerald-800 border-b border-gray-100 truncate mb-1 flex items-center gap-1.5">
              <RaptorPixelHead className="w-4 h-3.5" color="#059669" eyeColor="#064e3b" />
              <span>Raptor Hızlı İşlemler</span>
            </div>

            {onAddNewDownload && (
              <button
                onClick={() => {
                  onAddNewDownload();
                  setGlobalMenu(null);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 transition"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                <span>Yeni İndirme Ekle</span>
              </button>
            )}

            {onPauseAll && (
              <button
                onClick={() => {
                  onPauseAll();
                  setGlobalMenu(null);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-amber-50 hover:text-amber-800 text-gray-700 transition"
              >
                <Pause className="w-3.5 h-3.5 text-amber-600" />
                <span>Tümünü Duraklat</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenFolder('C:\\Downloads');
                setGlobalMenu(null);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 transition"
            >
              <FolderOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>İndirilenler Klasörünü Aç</span>
            </button>

            {onClearCompleted && (
              <>
                <div className="my-1 border-t border-gray-100" />
                <button
                  onClick={() => {
                    onClearCompleted();
                    setGlobalMenu(null);
                  }}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-rose-50 text-rose-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Tamamlananları Temizle</span>
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Global Native Task Context Menu (replaces browser right-click menu) */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          />
          <div
            className="fixed z-50 w-48 bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-xl shadow-2xl py-1.5 text-xs font-medium text-gray-700 select-none animate-in fade-in zoom-in-95 duration-100"
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 border-b border-gray-100 truncate mb-1">
              {contextMenu.task.fileName}
            </div>

            {contextMenu.task.status === 'Completed' && (
              <button
                onClick={() => {
                  onOpenFile ? onOpenFile(contextMenu.task.destinationPath) : onOpenFolder(contextMenu.task.destinationPath);
                  setContextMenu(null);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 font-semibold transition"
              >
                <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                <span>Dosyayı Aç</span>
              </button>
            )}

            <button
              onClick={() => {
                onOpenFolder(contextMenu.task.destinationPath);
                setContextMenu(null);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 transition"
            >
              <Folder className="w-3.5 h-3.5 text-emerald-600" />
              <span>Klasörde Göster</span>
            </button>

            {contextMenu.task.status === 'Downloading' ? (
              <button
                onClick={() => {
                  onPause(contextMenu.task.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-amber-50 hover:text-amber-800 text-gray-700 transition"
              >
                <Pause className="w-3.5 h-3.5 text-amber-600" />
                <span>İndirmeyi Duraklat</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onResume(contextMenu.task.id);
                  setContextMenu(null);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-emerald-50 hover:text-emerald-800 text-gray-700 transition"
              >
                {contextMenu.task.status === 'Failed' || contextMenu.task.status.startsWith('Failed') ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Yeniden Dene</span>
                  </>
                ) : contextMenu.task.status === 'Completed' ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Yeniden İndir</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-600" />
                    <span>İndirmeye Devam Et</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(contextMenu.task.url);
                } catch {
                  // ignore
                }
                setContextMenu(null);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700 transition"
            >
              <Copy className="w-3.5 h-3.5 text-gray-400" />
              <span>Bağlantıyı Kopyala</span>
            </button>

            <div className="my-1 border-t border-gray-100" />

            {selectedIds.size > 1 && selectedIds.has(contextMenu.task.id) && onPromptBatchDelete && (
              <button
                onClick={() => {
                  setContextMenu(null);
                  onPromptBatchDelete();
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-rose-50 text-rose-600 font-bold transition"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Seçilenleri Sil ({selectedIds.size})</span>
              </button>
            )}

            <button
              onClick={() => {
                onDelete(contextMenu.task.id);
                setContextMenu(null);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-rose-50 text-rose-600 transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Listeden Kaldır</span>
            </button>
          </div>
        </>
      )}

      {/* Smart Row Options Dropdown Menu (Fixed position, never clipped) */}
      {activeMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenu(null);
            }} 
            onContextMenu={(e) => {
              e.preventDefault();
              setActiveMenu(null);
            }}
          />
          <div 
            className="fixed z-50 w-48 bg-white/95 backdrop-blur-md border border-gray-200/90 rounded-xl shadow-2xl py-1.5 text-xs font-medium text-gray-700 select-none animate-in fade-in zoom-in-95 duration-100"
            style={{
              top: activeMenu.openUpward ? undefined : `${activeMenu.y}px`,
              bottom: activeMenu.openUpward ? `${Math.max(10, window.innerHeight - activeMenu.y)}px` : undefined,
              right: `${Math.max(12, window.innerWidth - activeMenu.x)}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1 text-[11px] font-semibold text-gray-400 border-b border-gray-100 truncate mb-1">
              {activeMenu.task.fileName}
            </div>

            <button
              onClick={() => {
                onOpenFolder(activeMenu.task.destinationPath);
                setActiveMenu(null);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700 transition"
            >
              <Folder className="w-3.5 h-3.5 text-gray-400" />
              <span>Klasörde Göster</span>
            </button>

            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(activeMenu.task.url);
                } catch {
                  // ignore
                }
                setActiveMenu(null);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700 transition"
            >
              <Copy className="w-3.5 h-3.5 text-gray-400" />
              <span>Bağlantıyı Kopyala</span>
            </button>

            {(activeMenu.task.status === 'Completed' || activeMenu.task.status === 'Failed' || activeMenu.task.status.startsWith('Failed')) && (
              <button
                onClick={() => {
                  onResume(activeMenu.task.id);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700 transition"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                <span>{activeMenu.task.status === 'Completed' ? 'Yeniden İndir' : 'Yeniden Dene'}</span>
              </button>
            )}

            <div className="my-1 border-t border-gray-100" />

            <button
              onClick={() => {
                onDelete(activeMenu.task.id);
                setActiveMenu(null);
              }}
              className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-rose-50 text-rose-600 font-semibold transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
              <span>Listeden Kaldır</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
