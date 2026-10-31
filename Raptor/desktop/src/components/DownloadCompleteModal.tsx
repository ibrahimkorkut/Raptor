import React from 'react';
import { 
  CheckCircle2, 
  FolderOpen, 
  Play, 
  X, 
  Film, 
  Disc, 
  FileArchive, 
  FileText, 
  FileCode, 
  File 
} from 'lucide-react';
import { DownloadTask } from '../types';

interface DownloadCompleteModalProps {
  task: DownloadTask | null;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
}

export const DownloadCompleteModal: React.FC<DownloadCompleteModalProps> = ({
  task,
  onClose,
  onOpenFile,
  onOpenFolder,
}) => {
  if (!task) return null;

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'iso' || ext === 'img') return <Disc className="w-6 h-6 text-emerald-600" />;
    if (['zip', 'rar', '7z', 'tar', 'gz', 'dmg'].includes(ext || '')) return <FileArchive className="w-6 h-6 text-emerald-600" />;
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext || '')) return <Film className="w-6 h-6 text-emerald-600" />;
    if (['pdf', 'doc', 'docx', 'txt'].includes(ext || '')) return <FileText className="w-6 h-6 text-emerald-600" />;
    if (['exe', 'msi', 'apk'].includes(ext || '')) return <FileCode className="w-6 h-6 text-emerald-600" />;
    return <File className="w-6 h-6 text-emerald-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-emerald-50/80 px-5 py-4 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">İndirme Tamamlandı</h2>
              <p className="text-[11px] text-emerald-700 font-medium">Raptor Yüksek Hızlı İndirici</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="flex items-start space-x-3.5 bg-gray-50/80 p-3.5 rounded-xl border border-gray-200/80">
            <div className="p-2.5 rounded-lg bg-white shadow-sm border border-gray-100 shrink-0">
              {getFileIcon(task.fileName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-gray-900 truncate text-sm" title={task.fileName}>
                {task.fileName}
              </div>
              <div className="text-gray-500 text-[11px] mt-0.5 flex items-center space-x-2">
                <span>Boyut: <strong className="text-gray-700">{formatBytes(task.totalBytes || task.downloadedBytes)}</strong></span>
                <span>•</span>
                <span className="text-emerald-600 font-medium">{task.category || 'Genel'}</span>
              </div>
              <div className="text-[11px] text-gray-400 truncate mt-1 font-mono" title={task.destinationPath}>
                {task.destinationPath}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => {
                onOpenFile(task.destinationPath);
                onClose();
              }}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#1b4327] hover:bg-[#15341f] text-white font-medium text-xs shadow-sm hover:shadow transition"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Dosyayı Aç</span>
            </button>
            <button
              onClick={() => {
                onOpenFolder(task.destinationPath);
                onClose();
              }}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200/80 text-gray-700 font-medium text-xs transition"
            >
              <FolderOpen className="w-3.5 h-3.5 text-gray-600" />
              <span>Klasörde Göster</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50/80 px-5 py-3 border-t border-gray-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 text-xs font-medium transition"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
};
