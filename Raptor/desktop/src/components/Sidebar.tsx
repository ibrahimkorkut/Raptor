import React from 'react';
import { RaptorPixelHead } from './RaptorPixelHead';
import { 
  Layers, 
  ArrowDownToLine, 
  Clock, 
  Pause, 
  CheckCircle2, 
  Folder, 
  Plus, 
  HardDrive, 
  Settings 
} from 'lucide-react';
import { WorkspaceSection, DiskInfo } from '../types';

interface SidebarProps {
  currentSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  counts: {
    all: number;
    downloading: number;
    queued: number;
    paused: number;
    completed: number;
    workFiles: number;
    personal: number;
  };
  diskInfo?: DiskInfo;
  onOpenDiskFolder?: () => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  onSelectSection,
  counts,
  diskInfo,
  onOpenDiskFolder,
  onOpenSettings,
}) => {
  return (
    <aside className="w-64 bg-[#111612] text-slate-300 flex flex-col justify-between border-r border-[#1c261e] select-none h-screen flex-shrink-0">
      <div className="p-4 space-y-6">
        {/* Brand / Logo */}
        <div className="flex items-center space-x-2.5 px-2 pt-1 group cursor-pointer" title={counts.downloading > 0 ? "Raptor verileri indiriyor!" : "Raptor Download Manager"}>
          <RaptorPixelHead
            className="w-8 h-7 flex-shrink-0 transition-transform group-hover:scale-105"
            chomping={counts.downloading > 0}
            eatingDots={counts.downloading > 0}
            speed={counts.downloading > 0 ? 'fast' : 'normal'}
          />
          <span className="text-xl font-bold text-white tracking-tight font-sans">
            Raptor
          </span>
        </div>

        {/* WORKSPACE Section */}
        <div className="space-y-1">
          <div className="px-2.5 pb-2 text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">
            Workspace
          </div>

          {/* All downloads */}
          <button
            onClick={() => onSelectSection('All downloads')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
              currentSection === 'All downloads'
                ? 'bg-[#1b2f1e] text-white font-semibold'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#162017]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Layers className="w-4 h-4 text-[#4ade80]" />
              <span>All downloads</span>
            </div>
            <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${
              currentSection === 'All downloads'
                ? 'bg-[#4ade80] text-[#0f1710]'
                : 'text-[#6b7280]'
            }`}>
              {counts.all}
            </span>
          </button>

          {/* Downloading */}
          <button
            onClick={() => onSelectSection('Downloading')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
              currentSection === 'Downloading'
                ? 'bg-[#1b2f1e] text-white font-semibold'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#162017]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <ArrowDownToLine className="w-4 h-4 text-[#4ade80]" />
              <span>Downloading</span>
            </div>
            <span className="text-[11px] font-mono text-[#9ca3af]">
              {counts.downloading}
            </span>
          </button>

          {/* Queued */}
          <button
            onClick={() => onSelectSection('Queued')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
              currentSection === 'Queued'
                ? 'bg-[#1b2f1e] text-white font-semibold'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#162017]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Clock className="w-4 h-4 text-[#9ca3af]" />
              <span>Queued</span>
            </div>
            <span className="text-[11px] font-mono text-[#9ca3af]">
              {counts.queued}
            </span>
          </button>

          {/* Paused */}
          <button
            onClick={() => onSelectSection('Paused')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
              currentSection === 'Paused'
                ? 'bg-[#1b2f1e] text-white font-semibold'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#162017]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Pause className="w-4 h-4 text-[#9ca3af]" />
              <span>Paused</span>
            </div>
            <span className="text-[11px] font-mono text-[#9ca3af]">
              {counts.paused}
            </span>
          </button>

          {/* Completed */}
          <button
            onClick={() => onSelectSection('Completed')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
              currentSection === 'Completed'
                ? 'bg-[#1b2f1e] text-white font-semibold'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#162017]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
              <span>Completed</span>
            </div>
            <span className="text-[11px] font-mono text-[#9ca3af]">
              {counts.completed}
            </span>
          </button>
        </div>

        {/* COLLECTIONS Section */}
        <div className="space-y-1 pt-2">
          <div className="flex items-center justify-between px-2.5 pb-2 text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">
            <span>Collections</span>
            <button className="text-[#9ca3af] hover:text-white transition">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => onSelectSection('Work files')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
              currentSection === 'Work files'
                ? 'bg-[#1b2f1e] text-white font-semibold'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#162017]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Folder className="w-4 h-4 text-[#9ca3af]" />
              <span>Work files</span>
            </div>
            <span className="text-[11px] font-mono text-[#9ca3af]">
              {counts.workFiles}
            </span>
          </button>

          <button
            onClick={() => onSelectSection('Personal')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition ${
              currentSection === 'Personal'
                ? 'bg-[#1b2f1e] text-white font-semibold'
                : 'text-[#9ca3af] hover:text-white hover:bg-[#162017]'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Folder className="w-4 h-4 text-[#9ca3af]" />
              <span>Personal</span>
            </div>
            <span className="text-[11px] font-mono text-[#9ca3af]">
              {counts.personal}
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Area: Storage Card + Settings + Creator Credit */}
      <div className="p-4 space-y-3 border-t border-[#1c261e]/60">
        {/* Drive Storage Widget */}
        <div 
          onClick={onOpenDiskFolder}
          className="bg-[#172019] border border-[#223024] rounded-xl p-3 space-y-2 cursor-pointer hover:border-[#2f4934] transition group"
          title="Tıklayarak bu diski açın"
        >
          <div className="flex items-center space-x-2 text-white text-xs font-semibold">
            <HardDrive className="w-3.5 h-3.5 text-[#4ade80]" />
            <span className="truncate">{diskInfo?.name || 'Yerel Disk (C:)'}</span>
          </div>
          <div className="w-full bg-[#0d140e] h-1.5 rounded-full overflow-hidden border border-[#1e2e21]">
            <div 
              className="bg-[#4ade80] h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(100, Math.max(0, diskInfo?.usedPercent ?? 95.7))}%` }} 
            />
          </div>
          <div className="text-[10px] text-[#9ca3af] font-mono">
            {diskInfo?.label || '19.4 GB free of 446.2 GB'}
          </div>
        </div>

        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#9ca3af] hover:text-white hover:bg-[#162017] transition"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>

        {/* Creator Footer Credit */}
        <div className="px-2 pt-1 flex items-center justify-between text-[10px] text-[#52525b] font-mono">
          <span>v.2.4.0</span>
          <button
            type="button"
            onClick={async () => {
              const url = 'https://github.com/ibrahimkorkut';
              try {
                const apiBase = window.location.port === '9145' ? '' : 'http://127.0.0.1:9145';
                await fetch(`${apiBase}/api/open-url`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ url }),
                });
              } catch {
                window.open(url, '_blank');
              }
            }}
            title="GitHub: https://github.com/ibrahimkorkut"
            className="hover:text-[#4ade80] transition-colors cursor-pointer flex items-center space-x-1 group"
          >
            <span className="text-[#52525b] group-hover:text-[#4ade80]/70">made by</span>
            <span className="text-[#9ca3af] group-hover:text-[#4ade80] font-medium underline-offset-2 hover:underline">
              İbrahim Korkut
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
