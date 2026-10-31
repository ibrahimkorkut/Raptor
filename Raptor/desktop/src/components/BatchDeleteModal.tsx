import React, { useState } from 'react';
import { Trash2, AlertTriangle, X, HardDrive } from 'lucide-react';
import { DownloadTask } from '../types';

interface BatchDeleteModalProps {
  isOpen: boolean;
  selectedTasks: DownloadTask[];
  onClose: () => void;
  onConfirmDelete: (deleteFilesFromDisk: boolean) => void;
}

export const BatchDeleteModal: React.FC<BatchDeleteModalProps> = ({
  isOpen,
  selectedTasks,
  onClose,
  onConfirmDelete,
}) => {
  const [deleteFilesFromDisk, setDeleteFilesFromDisk] = useState(false);

  if (!isOpen || selectedTasks.length === 0) return null;

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const totalSize = selectedTasks.reduce((acc, t) => acc + (t.totalBytes || 0), 0);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-[#111612] border border-[#233526] rounded-2xl shadow-2xl overflow-hidden text-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c291e] bg-[#0d120e]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Seçilen İndirmeleri Sil</h3>
              <p className="text-xs text-gray-400">
                Toplam {selectedTasks.length} dosya {totalSize > 0 && `(${formatBytes(totalSize)})`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-300">
            Aşağıda seçili olan <span className="font-bold text-white">{selectedTasks.length}</span> indirme Raptor listesinden kaldırılacaktır:
          </p>

          {/* Selected Files Preview List */}
          <div className="max-h-40 overflow-y-auto space-y-1.5 p-2 bg-[#090d0a] border border-[#1b261d] rounded-xl">
            {selectedTasks.map((task) => (
              <div 
                key={task.id}
                className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg bg-[#111712] border border-[#1e2c20]/60"
              >
                <span className="truncate max-w-[260px] text-gray-200 font-medium">
                  {task.fileName}
                </span>
                <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2 font-mono">
                  {formatBytes(task.totalBytes)}
                </span>
              </div>
            ))}
          </div>

          {/* Delete From Disk Option */}
          <label 
            onClick={() => setDeleteFilesFromDisk(!deleteFilesFromDisk)}
            className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition select-none ${
              deleteFilesFromDisk 
                ? 'bg-rose-950/20 border-rose-500/40 text-rose-200' 
                : 'bg-[#0d120e] border-[#1e2c20] text-gray-300 hover:border-gray-600'
            }`}
          >
            <input 
              type="checkbox"
              checked={deleteFilesFromDisk}
              onChange={(e) => setDeleteFilesFromDisk(e.target.checked)}
              className="mt-0.5 rounded border-gray-600 text-rose-600 focus:ring-0 w-4 h-4"
            />
            <div className="flex-1">
              <div className="flex items-center space-x-1.5 text-xs font-semibold">
                <HardDrive className="w-3.5 h-3.5 text-rose-400" />
                <span>İndirilen dosyaları bilgisayarımdan (diskten) da kalıcı olarak sil</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                İşaretlenmezse dosyalar bilgisayarınızda kalır, yalnızca Raptor indirme listesinden silinir.
              </p>
            </div>
          </label>

          {deleteFilesFromDisk && (
            <div className="flex items-center space-x-2 text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
              <span>Dikkat: Dosyalar Windows Geri Dönüşüm Kutusu'na gönderilmeden kalıcı olarak silinecektir.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-[#0d120e] border-t border-[#1c291e]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-300 hover:text-white hover:bg-white/5 transition"
          >
            Vazgeç
          </button>
          <button
            onClick={() => onConfirmDelete(deleteFilesFromDisk)}
            className="flex items-center space-x-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-950/50 transition duration-150"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Seçilenleri Sil ({selectedTasks.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
