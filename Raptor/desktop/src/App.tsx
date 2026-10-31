import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { RaptorHeader } from './components/RaptorHeader';
import { StatsCards } from './components/StatsCards';
import { FilterTabs } from './components/FilterTabs';
import { RaptorDownloadList } from './components/RaptorDownloadList';
import { RaptorFooter } from './components/RaptorFooter';
import { AddDownloadModal } from './components/AddDownloadModal';
import { SettingsModal } from './components/SettingsModal';
import { DownloadCompleteModal } from './components/DownloadCompleteModal';
import { SpeedLimitModal } from './components/SpeedLimitModal';
import { BatchDeleteModal } from './components/BatchDeleteModal';
import { RaptorPixelHead } from './components/RaptorPixelHead';
import { 
  DownloadTask, 
  WorkspaceSection, 
  FileCategory,
  DiskInfo
} from './types';

interface IncomingDownloadItem {
  url: string;
  filename?: string;
  quality?: string;
  referer?: string;
  cookie?: string;
  fileSize?: number;
  mime?: string;
}

export const App: React.FC = () => {
  const [currentSection, setCurrentSection] = useState<WorkspaceSection>('All downloads');
  const [currentCategory, setCurrentCategory] = useState<FileCategory>('All files');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Date added');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpeedLimitModalOpen, setIsSpeedLimitModalOpen] = useState(false);
  const [completedModalTask, setCompletedModalTask] = useState<DownloadTask | null>(null);
  const [currentSpeedLimitBps, setCurrentSpeedLimitBps] = useState<number>(0);
  const [incomingDownload, setIncomingDownload] = useState<IncomingDownloadItem | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);

  // Track completed IDs for completion modal notification
  const initialLoadDone = useRef(false);
  const knownCompletedIds = useRef<Set<string>>(new Set());

  // Active Toast notification state
  const [toast, setToast] = useState<{ text: string; type: 'info' | 'success' | 'warn' } | null>(null);

  const showToast = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((curr) => (curr?.text === text ? null : curr));
    }, 3500);
  };

  const apiBase = window.location.port === '9145' ? '' : 'http://127.0.0.1:9145';

  // Completely eliminate browser behavior (no browser context menu, no browser reload/print shortcuts)
  useEffect(() => {
    const disableContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const disableBrowserKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (
        e.key === 'F5' ||
        (e.ctrlKey && ['r', 'p', 'u', 's', 'o', 'j', 'f', 'g'].includes(key)) ||
        (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight'))
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', disableContextMenu, true);
    document.addEventListener('contextmenu', disableContextMenu, true);
    window.addEventListener('keydown', disableBrowserKeys, true);

    const handleShortcuts = (e: KeyboardEvent) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedTaskIds.size > 0 &&
        !isAddModalOpen &&
        !isSettingsOpen &&
        !isSpeedLimitModalOpen &&
        !isBatchDeleteModalOpen &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setIsBatchDeleteModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcuts);

    return () => {
      window.removeEventListener('contextmenu', disableContextMenu, true);
      document.removeEventListener('contextmenu', disableContextMenu, true);
      window.removeEventListener('keydown', disableBrowserKeys, true);
      window.removeEventListener('keydown', handleShortcuts);
    };
  }, [selectedTaskIds, isAddModalOpen, isSettingsOpen, isSpeedLimitModalOpen, isBatchDeleteModalOpen]);

  // Real live tasks from backend Rust engine
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  // Periodic poll of true engine downloads
  const fetchTasks = async () => {
    try {
      const resp = await fetch(`${apiBase}/api/downloads`);
      if (resp.ok) {
        const data: DownloadTask[] = await resp.json();
        if (!initialLoadDone.current) {
          data.forEach((t) => {
            if (t.status === 'Completed') knownCompletedIds.current.add(t.id);
          });
          initialLoadDone.current = true;
        } else {
          for (const t of data) {
            if (t.status === 'Completed' && !knownCompletedIds.current.has(t.id)) {
              knownCompletedIds.current.add(t.id);
              setCompletedModalTask(t);
              showToast(`✓ ${t.fileName} indirildi!`, 'success');
              break;
            }
          }
        }
        setTasks(data);
      }
    } catch {
      // Backend not yet available
    }
  };

  // Poll for incoming browser intercepted downloads
  const fetchIncoming = async () => {
    try {
      const resp = await fetch(`${apiBase}/api/downloads/incoming`);
      if (resp.ok) {
        const list = await resp.json();
        if (Array.isArray(list) && list.length > 0) {
          const first = list[0];
          setIncomingDownload(first);
          setIsAddModalOpen(true);
        }
      }
    } catch {
      // ignore
    }
  };

  // Fetch initial speed limit
  const fetchSpeedLimit = async () => {
    try {
      const resp = await fetch(`${apiBase}/api/settings/speed-limit`);
      if (resp.ok) {
        const data = await resp.json();
        if (typeof data.limitBps === 'number') {
          setCurrentSpeedLimitBps(data.limitBps);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchSpeedLimit();
    const interval = setInterval(() => {
      fetchTasks();
      fetchIncoming();
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Real Disk Information State
  const [diskInfo, setDiskInfo] = useState<DiskInfo>({
    drive: 'C:',
    name: 'Yerel Disk (C:)',
    freeGB: 19.4,
    totalGB: 446.2,
    usedGB: 426.8,
    usedPercent: 95.7,
    label: '19.4 GB free of 446.2 GB',
  });

  // Dynamically inspect whichever disk the application/user downloads to
  useEffect(() => {
    const latestTask = tasks.find((t) => t.status === 'Downloading') || tasks[0];
    const destination = latestTask?.destinationPath || 'C:\\Downloads';

    const fetchDiskInfo = async () => {
      try {
        const resp = await fetch(`http://127.0.0.1:9145/api/system/disk?path=${encodeURIComponent(destination)}`);
        if (resp.ok) {
          const data: DiskInfo = await resp.json();
          setDiskInfo(data);
        }
      } catch {
        // Fallback default
      }
    };

    fetchDiskInfo();
    const interval = setInterval(fetchDiskInfo, 5000);
    return () => clearInterval(interval);
  }, [tasks]);

  // Actions
  const handleOpenFolder = async (path: string) => {
    try {
      await fetch(`${apiBase}/api/open-folder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    } catch {
      try {
        await navigator.clipboard.writeText(path);
      } catch {
        // ignore
      }
    }
  };

  const handleOpenFile = async (path: string) => {
    try {
      await fetch(`${apiBase}/api/open-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      });
    } catch {
      // ignore
    }
  };

  const handleOpenDownloadsFolder = () => {
    const userDownloads = 'C:\\Downloads';
    handleOpenFolder(userDownloads);
  };

  const handlePause = async (id: string) => {
    try {
      await fetch(`${apiBase}/api/download/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchTasks();
      const target = tasks.find((t) => t.id === id);
      if (target) showToast(`⏸️ İndirme duraklatıldı: ${target.fileName}`, 'warn');
    } catch {
      // ignore
    }
  };

  const handleResume = async (id: string) => {
    try {
      await fetch(`${apiBase}/api/download/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchTasks();
      const target = tasks.find((t) => t.id === id);
      if (target) showToast(`▶️ İndirme devam ediyor: ${target.fileName}`, 'success');
    } catch {
      // ignore
    }
  };

  const handlePauseAll = async () => {
    const running = tasks.filter((t) => t.status === 'Downloading');
    for (const t of running) {
      await fetch(`${apiBase}/api/download/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: t.id }),
      }).catch(() => {});
    }
    fetchTasks();
    showToast('⏸️ Tüm indirmeler duraklatıldı', 'warn');
  };

  const handleDelete = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    try {
      await fetch(`${apiBase}/api/download/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, deleteFile: false }),
      });
      setTasks((prev) => prev.filter((t) => t.id !== id));
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (target) showToast(`🗑️ Silindi: ${target.fileName}`, 'warn');
      fetchTasks();
    } catch {
      // ignore
    }
  };

  const handleToggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllTasks = () => {
    setSelectedTaskIds(new Set(filteredTasks.map((t) => t.id)));
  };

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const handleBatchPause = async () => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`${apiBase}/api/download/pause`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          })
        )
      );
      showToast(`⏸️ ${ids.length} indirme duraklatıldı`, 'info');
      setTimeout(fetchTasks, 300);
    } catch {
      showToast('İndirmeler duraklatılamadı', 'warn');
    }
  };

  const handleBatchResume = async () => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`${apiBase}/api/download/resume`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          })
        )
      );
      showToast(`▶️ ${ids.length} indirme devam ettiriliyor`, 'success');
      setTimeout(fetchTasks, 300);
    } catch {
      showToast('İndirmeler başlatılamadı', 'warn');
    }
  };

  const handleConfirmBatchDelete = async (deleteFilesFromDisk: boolean) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`${apiBase}/api/download/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, deleteFile: deleteFilesFromDisk }),
          })
        )
      );
      setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
      setSelectedTaskIds(new Set());
      setIsBatchDeleteModalOpen(false);
      showToast(
        deleteFilesFromDisk
          ? `🗑️ ${ids.length} dosya ve indirme diskten kalıcı olarak silindi`
          : `🗑️ ${ids.length} indirme listeden silindi`,
        'warn'
      );
      setTimeout(fetchTasks, 300);
    } catch {
      showToast('❌ Bazı indirmeler silinemedi', 'warn');
    }
  };

  const handleClearCompleted = async () => {
    try {
      await fetch(`${apiBase}/api/download/clear-completed`, {
        method: 'POST',
      });
      setTasks((prev) => prev.filter((t) => t.status !== 'Completed'));
      showToast('🗑️ Tamamlanan tüm indirmeler temizlendi', 'info');
      fetchTasks();
    } catch {
      // ignore
    }
  };

  const handleApplySpeedLimit = async (limitBps: number) => {
    try {
      await fetch(`${apiBase}/api/settings/speed-limit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limitBps }),
      });
      setCurrentSpeedLimitBps(limitBps);
      if (limitBps === 0) {
        showToast('Hız Sınırı: Sınırsız (Limitsiz)', 'info');
      } else {
        const mb = (limitBps / (1024 * 1024)).toFixed(1);
        showToast(`Hız Sınırı Belirlendi: ${mb} MB/s`, 'info');
      }
    } catch {
      showToast('Hız sınırı uygulanamadı', 'warn');
    }
  };

  const formatSpeedLimitString = (bps: number) => {
    if (!bps || bps === 0) return 'Unlimited';
    if (bps >= 1024 * 1024) {
      const mb = bps / (1024 * 1024);
      return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB/s`;
    }
    return `${Math.round(bps / 1024)} KB/s`;
  };

  const handleStartNewDownload = async (params: {
    url: string;
    destinationDir: string;
    filename: string;
    connections: number;
    category: FileCategory;
    quality?: string;
    referer?: string;
    cookie?: string;
    paused?: boolean;
  }) => {
    try {
      const resp = await fetch(`${apiBase}/api/download/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: params.url,
          destinationDir: params.destinationDir,
          filename: params.filename || undefined,
          connections: params.connections,
          category: params.category,
          quality: params.quality,
          referer: params.referer,
          cookie: params.cookie,
          paused: params.paused || false,
        }),
      });
      const data = await resp.json().catch(() => ({ success: resp.ok }));
      if (resp.ok && data.success !== false) {
        showToast(params.paused ? 'Raptor: İndirme kuyruğa eklendi (Bekliyor)' : 'Raptor: İndirme başlatıldı', 'success');
        setTimeout(fetchTasks, 300);
      } else {
        const reason = typeof data.error === 'string' ? data.error.slice(0, 140) : '';
        showToast(`❌ İndirme başlatılamadı${reason ? `: ${reason}` : ''}`, 'warn');
      }
    } catch {
      showToast('❌ Sunucuya ulaşılamıyor', 'warn');
    }
  };

  // Filter Tasks
  const filteredTasks = tasks.filter((t) => {
    // 1. Workspace section filter
    if (currentSection === 'Downloading') {
      if (t.status !== 'Downloading') return false;
    } else if (currentSection === 'Queued') {
      if (t.status !== 'Queued') return false;
    } else if (currentSection === 'Paused') {
      if (t.status !== 'Paused') return false;
    } else if (currentSection === 'Completed') {
      if (t.status !== 'Completed') return false;
    } else if (currentSection === 'Work files') {
      if (t.collection !== 'Work files') return false;
    } else if (currentSection === 'Personal') {
      if (t.collection !== 'Personal') return false;
    }

    // 2. Category tab filter
    if (currentCategory !== 'All files') {
      if (t.category !== currentCategory) return false;
    }

    // 3. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.fileName.toLowerCase().includes(q) && !t.domain.toLowerCase().includes(q)) {
        return false;
      }
    }

    return true;
  });

  // Calculate sidebar counts
  const counts = {
    all: tasks.length,
    downloading: tasks.filter((t) => t.status === 'Downloading').length,
    queued: tasks.filter((t) => t.status === 'Queued').length,
    paused: tasks.filter((t) => t.status === 'Paused').length,
    completed: tasks.filter((t) => t.status === 'Completed').length,
    workFiles: tasks.filter((t) => t.collection === 'Work files').length,
    personal: tasks.filter((t) => t.collection === 'Personal').length,
  };

  // Calculate stats KPI
  const activeDownloading = tasks.filter((t) => t.status === 'Downloading');
  const totalSpeedBps = activeDownloading.reduce((sum, t) => sum + t.currentSpeedBps, 0);
  const totalSpeedFormatted = totalSpeedBps > 0 ? `${(totalSpeedBps / 1048576).toFixed(1)} MB/s` : '0.0 MB/s';

  const totalBytesSum = tasks.reduce((sum, t) => sum + (t.totalBytes || 0), 0);
  const totalSizeFormatted = `${(totalBytesSum / 1073741824).toFixed(2)} GB`;

  return (
    <div className="flex h-screen bg-[#fcfdfc] text-[#111827] overflow-hidden select-none font-sans" onContextMenu={(e) => e.preventDefault()}>
      {/* 1. Dark Forest Green Sidebar */}
      <Sidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        counts={counts}
        diskInfo={diskInfo}
        onOpenDiskFolder={() => handleOpenFolder(diskInfo.drive + '\\')}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Main Content Dashboard */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#fcfdfc]">
        {/* Scrollable Workspace Container */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {/* Header */}
          <RaptorHeader
            currentSection={currentSection}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onPauseAll={handlePauseAll}
            onAddDownload={() => {
              setIncomingDownload(null);
              setIsAddModalOpen(true);
            }}
            downloadingCount={counts.downloading}
          />

          {/* 3 Metric Cards */}
          <StatsCards
            currentSpeedFormatted={totalSpeedFormatted}
            activeSlots={counts.downloading}
            totalSlots={3}
            downloadedSessionFormatted="6.42 GB"
            totalSessionFiles={5}
          />

          {/* Category Filter Pills & Sort Button / Batch Actions Bar */}
          <FilterTabs
            currentCategory={currentCategory}
            onSelectCategory={setCurrentCategory}
            sortBy={sortBy}
            onToggleSort={() => setSortBy(sortBy === 'Date added' ? 'File size' : 'Date added')}
            selectedCount={selectedTaskIds.size}
            onBatchDelete={() => setIsBatchDeleteModalOpen(true)}
            onBatchPause={handleBatchPause}
            onBatchResume={handleBatchResume}
            onClearSelection={handleClearSelection}
            hasActiveDownloads={tasks.some((t) => selectedTaskIds.has(t.id) && t.status === 'Downloading')}
            hasPausedDownloads={tasks.some((t) => selectedTaskIds.has(t.id) && (t.status === 'Paused' || t.status === 'Queued'))}
          />

          {/* Download Items Grouped List */}
          <RaptorDownloadList
            tasks={filteredTasks}
            onPause={handlePause}
            onResume={handleResume}
            onOpenFolder={handleOpenFolder}
            onOpenFile={handleOpenFile}
            onDelete={handleDelete}
            onAddNewDownload={() => {
              setIncomingDownload(null);
              setIsAddModalOpen(true);
            }}
            onPauseAll={handlePauseAll}
            onClearCompleted={handleClearCompleted}
            selectedIds={selectedTaskIds}
            onToggleSelect={handleToggleSelectTask}
            onSelectAll={handleSelectAllTasks}
            onClearSelection={handleClearSelection}
            onPromptBatchDelete={() => setIsBatchDeleteModalOpen(true)}
          />

          {/* Footer Bar */}
          <RaptorFooter
            totalCount={tasks.length}
            totalSizeFormatted={totalSizeFormatted}
            onClearCompleted={handleClearCompleted}
            onOpenDownloadsFolder={handleOpenDownloadsFolder}
            speedLimitFormatted={formatSpeedLimitString(currentSpeedLimitBps)}
            onToggleSpeedLimit={() => setIsSpeedLimitModalOpen(true)}
          />
        </div>
      </main>

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed bottom-10 right-8 z-50 flex items-center space-x-2 px-4 py-2.5 rounded-xl shadow-xl border text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200 ${
          toast.type === 'success'
            ? 'bg-[#1b4327] border-[#2d6a3f] text-white'
            : toast.type === 'warn'
              ? 'bg-amber-900 border-amber-700 text-amber-100'
              : 'bg-gray-900 border-gray-800 text-white'
        }`}>
          <div className="flex items-center space-x-2">
            <RaptorPixelHead className="w-4 h-3.5 flex-shrink-0" color={toast.type === 'success' ? '#a3e635' : '#34d399'} eyeColor="#111612" />
            <span>{toast.text.replace(/^⚡\s*/, '')}</span>
          </div>
        </div>
      )}

      {/* Add Download Modal */}
      <AddDownloadModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setIncomingDownload(null);
        }}
        onStartDownload={handleStartNewDownload}
        initialUrl={incomingDownload?.url || ''}
        initialFilename={incomingDownload?.filename || ''}
        initialQuality={incomingDownload?.quality || 'best'}
        initialReferer={incomingDownload?.referer || ''}
        initialCookie={incomingDownload?.cookie || ''}
        initialFileSize={incomingDownload?.fileSize}
        initialMime={incomingDownload?.mime}
      />

      {/* Speed Limit Modal */}
      <SpeedLimitModal
        isOpen={isSpeedLimitModalOpen}
        onClose={() => setIsSpeedLimitModalOpen(false)}
        currentLimitBps={currentSpeedLimitBps}
        onApplyLimit={handleApplySpeedLimit}
      />

      {/* Download Complete Modal */}
      <DownloadCompleteModal
        task={completedModalTask}
        onClose={() => setCompletedModalTask(null)}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Batch Delete Confirmation Modal */}
      <BatchDeleteModal
        isOpen={isBatchDeleteModalOpen}
        selectedTasks={tasks.filter((t) => selectedTaskIds.has(t.id))}
        onClose={() => setIsBatchDeleteModalOpen(false)}
        onConfirmDelete={handleConfirmBatchDelete}
      />
    </div>
  );
};
