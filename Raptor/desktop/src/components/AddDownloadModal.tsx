import React, { useState, useEffect } from 'react';
import { X, Download, Folder, Globe, Film, Music, Archive, FileText, AppWindow, Clock } from 'lucide-react';
import { FileCategory } from '../types';
import { RaptorPixelHead } from './RaptorPixelHead';

interface AddDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDownload: (params: {
    url: string;
    destinationDir: string;
    filename: string;
    connections: number;
    category: FileCategory;
    quality?: string;
    referer?: string;
    cookie?: string;
    paused?: boolean;
  }) => void;
  initialUrl?: string;
  initialFilename?: string;
  initialQuality?: string;
  initialReferer?: string;
  initialCookie?: string;
  initialFileSize?: number | null;
  initialMime?: string | null;
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return 'Boyut Belirsiz';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2).replace('.', ',')} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} GB`;
}

type IdmCategory = 'Programlar' | 'Sıkıştırılmış' | 'Videolar' | 'Müzik' | 'Belgeler' | 'Genel';

function getExtension(str: string): string {
  if (!str) return '';
  const clean = str.split('?')[0].split('#')[0];
  const parts = clean.split('.');
  if (parts.length > 1) {
    return parts.pop()?.toLowerCase() || '';
  }
  return '';
}

function categorizeFile(fn: string, targetUrl: string, mime?: string | null): {
  idmCategory: IdmCategory;
  appCategory: FileCategory;
  folder: string;
  typeLabel: string;
  icon: 'program' | 'archive' | 'video' | 'audio' | 'document' | 'general';
} {
  const ext = getExtension(fn) || getExtension(targetUrl);
  const m = (mime || '').toLowerCase();
  const lowerUrl = (targetUrl || '').toLowerCase();

  const mediaDomains = [
    'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'tiktok.com',
    'instagram.com', 'reddit.com', 'v.redd.it', 'facebook.com', 'fb.watch',
    'twitch.tv', 'vimeo.com', 'dailymotion.com', 'soundcloud.com', '.m3u8', '.mpd',
    'bilibili.com', 'threads.net', 'kick.com'
  ];

  if (
    ['exe', 'msi', 'bat', 'cmd', 'apk', 'bin', 'dmg', 'pkg', 'deb', 'rpm'].includes(ext) ||
    m.includes('msdownload') ||
    m.includes('executable')
  ) {
    return {
      idmCategory: 'Programlar',
      appCategory: 'Programs',
      folder: 'Programs',
      typeLabel: 'Uygulama / Kurulum Dosyası',
      icon: 'program',
    };
  }

  if (
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'iso', 'zst'].includes(ext) ||
    m.includes('zip') ||
    m.includes('compressed') ||
    m.includes('tar') ||
    m.includes('iso')
  ) {
    return {
      idmCategory: 'Sıkıştırılmış',
      appCategory: 'Compressed',
      folder: 'Compressed',
      typeLabel: 'Sıkıştırılmış Arşiv',
      icon: 'archive',
    };
  }

  if (
    ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'm3u8', 'mpd', 'ts'].includes(ext) ||
    m.startsWith('video/') ||
    mediaDomains.some((d) => lowerUrl.includes(d))
  ) {
    return {
      idmCategory: 'Videolar',
      appCategory: 'Video',
      folder: 'Video',
      typeLabel: mediaDomains.some((d) => lowerUrl.includes(d)) ? 'Çevrimiçi Medya / Video Akışı' : 'Video Dosyası',
      icon: 'video',
    };
  }

  if (
    ['mp3', 'flac', 'wav', 'aac', 'ogg', 'm4a', 'opus'].includes(ext) ||
    m.startsWith('audio/')
  ) {
    return {
      idmCategory: 'Müzik',
      appCategory: 'Music',
      folder: 'Music',
      typeLabel: 'Ses / Müzik Dosyası',
      icon: 'audio',
    };
  }

  if (
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext) ||
    m.includes('pdf') ||
    m.includes('document')
  ) {
    return {
      idmCategory: 'Belgeler',
      appCategory: 'Documents',
      folder: 'Documents',
      typeLabel: 'Belge / Doküman',
      icon: 'document',
    };
  }

  return {
    idmCategory: 'Genel',
    appCategory: 'General',
    folder: 'General',
    typeLabel: 'Genel Dosya',
    icon: 'general',
  };
}

export const AddDownloadModal: React.FC<AddDownloadModalProps> = ({
  isOpen,
  onClose,
  onStartDownload,
  initialUrl = '',
  initialFilename = '',
  initialQuality = 'best',
  initialReferer = '',
  initialCookie = '',
  initialFileSize = null,
  initialMime = null,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [baseDir, setBaseDir] = useState('C:\\Downloads');
  const [filename, setFilename] = useState(initialFilename);
  const [fileSize, setFileSize] = useState<number | null>(initialFileSize || null);
  const [mime, setMime] = useState<string | null>(initialMime || null);
  const [description, setDescription] = useState('');
  const [rememberPath, setRememberPath] = useState(true);
  const [isDetecting, setIsDetecting] = useState(false);

  // Category selection
  const [selectedIdmCategory, setSelectedIdmCategory] = useState<IdmCategory>('Genel');

  // Format & Quality selections (ONLY for media / videos)
  const [formatType, setFormatType] = useState<'mp4' | 'mkv' | 'mp3' | 'webm'>('mp4');
  const [videoQuality, setVideoQuality] = useState<string>('best');
  const [audioQuality, setAudioQuality] = useState<string>('audio-320k');
  const [referer, setReferer] = useState(initialReferer);
  const [cookie, setCookie] = useState(initialCookie);

  // Check if target is media stream
  const isMediaStream = (targetUrl: string, fn: string): boolean => {
    const lower = (targetUrl || '').toLowerCase();
    const mediaDomains = [
      'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'tiktok.com',
      'instagram.com', 'reddit.com', 'v.redd.it', 'facebook.com', 'fb.watch',
      'twitch.tv', 'vimeo.com', 'dailymotion.com', 'soundcloud.com', '.m3u8', '.mpd',
      'bilibili.com', 'threads.net', 'kick.com'
    ];
    if (mediaDomains.some((d) => lower.includes(d))) return true;

    const ext = getExtension(fn) || getExtension(lower);
    return ['mp4', 'mkv', 'webm', 'avi', 'mov', 'flv', 'mp3', 'm4a', 'wav', 'flac'].includes(ext);
  };

  const isMedia = isMediaStream(url, filename);

  useEffect(() => {
    if (isOpen) {
      setUrl(initialUrl || '');
      setFilename(initialFilename || '');
      setReferer(initialReferer || '');
      setCookie(initialCookie || '');
      setFileSize(initialFileSize || null);
      setMime(initialMime || null);
      setDescription('');
      setIsDetecting(false);

      const catInfo = categorizeFile(initialFilename || '', initialUrl || '', initialMime);
      setSelectedIdmCategory(catInfo.idmCategory);

      if (initialQuality) {
        if (initialQuality.startsWith('audio-') || initialQuality === 'mp3') {
          setFormatType('mp3');
          setAudioQuality(initialQuality === 'mp3' ? 'audio-320k' : initialQuality);
        } else if (initialQuality.includes('mkv')) {
          setFormatType('mkv');
          setVideoQuality('best');
        } else if (initialQuality.includes('webm')) {
          setFormatType('webm');
          setVideoQuality('best');
        } else {
          setFormatType('mp4');
          setVideoQuality(initialQuality);
        }
      }
    }
  }, [isOpen, initialUrl, initialFilename, initialQuality, initialReferer, initialCookie, initialFileSize, initialMime]);

  // Dynamically probe file or media info when URL changes
  useEffect(() => {
    if (!url.trim() || !isOpen) return;

    const timer = setTimeout(async () => {
      try {
        setIsDetecting(true);
        const apiBase = window.location.port === '9145' ? '' : 'http://127.0.0.1:9145';
        const resp = await fetch(`${apiBase}/api/media/probe?url=${encodeURIComponent(url.trim())}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.success) {
            if (data.isMedia && data.title) {
              setFilename(data.title);
            } else if (!data.isMedia) {
              if (data.filename && !filename) {
                setFilename(data.filename);
              }
              if (typeof data.fileSize === 'number' && data.fileSize > 0) {
                setFileSize(data.fileSize);
              }
              if (data.mime) {
                setMime(data.mime);
              }
            }
          }
        }
      } catch {
        // ignore
      } finally {
        setIsDetecting(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [url, isOpen]);

  // Auto-update category when filename, url or mime changes
  useEffect(() => {
    if (filename || url) {
      const catInfo = categorizeFile(filename, url, mime);
      setSelectedIdmCategory(catInfo.idmCategory);
    }
  }, [url, filename, mime]);

  if (!isOpen) return null;

  const currentCatInfo = categorizeFile(filename, url, mime);

  // Native folder browser dialog
  const handleBrowseFolder = async () => {
    try {
      const apiBase = window.location.port === '9145' ? '' : 'http://127.0.0.1:9145';
      const resp = await fetch(`${apiBase}/api/browse-folder`, { method: 'POST' });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.path) {
          setBaseDir(data.path);
        }
      }
    } catch {
      // ignore
    }
  };

  const handleStart = (paused = false) => {
    if (!url.trim()) return;

    let finalQuality = 'best';
    if (isMedia) {
      if (formatType === 'mp3') {
        finalQuality = audioQuality;
      } else if (formatType === 'mkv') {
        finalQuality = videoQuality === 'best' ? 'mkv' : `${videoQuality}-mkv`;
      } else {
        finalQuality = videoQuality;
      }
    }

    let cleanFilename = filename.trim();
    if (cleanFilename && isMedia) {
      const cleanStem = cleanFilename.replace(/\.(mp4|mkv|mp3|webm|m4a|avi|flv)$/i, '');
      cleanFilename = `${cleanStem}.${formatType}`;
    }

    // Save destination subfolder based on category
    const catSubfolder = currentCatInfo.folder;
    const finalDir = rememberPath ? `${baseDir}\\${catSubfolder}` : baseDir;

    onStartDownload({
      url: url.trim(),
      destinationDir: finalDir,
      filename: cleanFilename,
      connections: 32,
      category: currentCatInfo.appCategory,
      quality: isMedia ? finalQuality : undefined,
      referer: referer.trim() || undefined,
      cookie: cookie.trim() || undefined,
      paused,
    });
    onClose();
  };

  const fullSavePath = `${baseDir}\\${currentCatInfo.folder}\\${filename || 'isimsiz_dosya'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150 font-sans">
      <div className="bg-[#1f2328] border border-[#3b424c] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150 text-gray-200">
        {/* IDM Style Title Bar */}
        <div className="bg-[#181b1f] px-4 py-3 border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center shadow-inner">
              <RaptorPixelHead className="w-5 h-4" color="#4ade80" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center space-x-2">
                <span>Dosya İndirme Bilgisi</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-1.5 py-0.5 rounded border border-emerald-500/30">
                  RAPTOR TURBO
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Top Form Section: Fields + Right File Info Badge */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Left 3 columns: Inputs */}
            <div className="md:col-span-3 space-y-3">
              {/* URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-400 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5">
                    <Globe className="w-3.5 h-3.5 text-gray-500" />
                    <span>URL</span>
                  </span>
                  {isDetecting && (
                    <span className="text-[10px] text-emerald-400 font-mono animate-pulse">
                      ● Doğrulanıyor...
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  data-testid="download-url-input"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => {
                    const newUrl = e.target.value;
                    setUrl(newUrl);
                    const ext = getExtension(newUrl);
                    if (ext && !filename) {
                      const seg = newUrl.split('?')[0].split('#')[0].split('/').filter(Boolean).pop();
                      if (seg) setFilename(decodeURIComponent(seg));
                    }
                    const catInfo = categorizeFile(filename, newUrl, mime);
                    setSelectedIdmCategory(catInfo.idmCategory);
                  }}
                  className="w-full bg-[#16181c] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500 font-mono truncate"
                />
              </div>

              {/* Kategori */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-400">Kategori</label>
                <div className="flex items-center space-x-2">
                  <select
                    data-testid="category-select"
                    value={selectedIdmCategory}
                    onChange={(e) => setSelectedIdmCategory(e.target.value as IdmCategory)}
                    className="flex-1 bg-[#16181c] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium"
                  >
                    <option value="Programlar">Programlar (EXE, MSI, APK vb.)</option>
                    <option value="Sıkıştırılmış">Sıkıştırılmış (ZIP, RAR, 7Z, ISO)</option>
                    <option value="Videolar">Videolar (MP4, MKV, WebM)</option>
                    <option value="Müzik">Müzik / Ses (MP3, FLAC, WAV)</option>
                    <option value="Belgeler">Belgeler (PDF, DOCX, XLSX)</option>
                    <option value="Genel">Genel / Diğer</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="px-2.5 py-1.5 bg-[#252a30] hover:bg-[#2c323a] text-gray-300 border border-[#38404a] rounded-lg text-xs font-bold"
                    title="Yeni Kategori"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Kaydet (Folder + Filename) */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-400 flex items-center space-x-1.5">
                  <Folder className="w-3.5 h-3.5 text-gray-500" />
                  <span>Kaydet</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={fullSavePath}
                    readOnly
                    className="flex-1 bg-[#16181c] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-gray-300 font-mono truncate"
                    title={fullSavePath}
                  />
                  <button
                    type="button"
                    onClick={handleBrowseFolder}
                    className="px-3 py-1.5 bg-[#252a30] hover:bg-[#2c323a] text-gray-200 border border-[#38404a] rounded-lg text-xs font-semibold transition"
                    title="Klasör Seç (Gözat)"
                  >
                    ...
                  </button>
                </div>

                {/* Remember path checkbox */}
                <label className="flex items-center space-x-2 pt-1 text-[11px] text-gray-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberPath}
                    onChange={(e) => setRememberPath(e.target.checked)}
                    className="rounded bg-[#16181c] border-[#30363d] text-emerald-600 focus:ring-0"
                  />
                  <span>"{selectedIdmCategory}" kategorisi için bu yolu hatırla</span>
                </label>
              </div>

              {/* Açıklama (Optional) */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-gray-400">Açıklama</label>
                <input
                  type="text"
                  placeholder="İsteğe bağlı indirme notu..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-[#16181c] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Right 1 column: Large File Info Badge (Exact match to Photo 3) */}
            <div className="md:col-span-1 flex flex-col items-center justify-center bg-[#181b1f] border border-[#2d333b] rounded-xl p-4 text-center">
              {/* File Icon */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-lg border border-white/5">
                {currentCatInfo.icon === 'program' && (
                  <div className="w-full h-full rounded-2xl bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                    <AppWindow className="w-7 h-7" />
                  </div>
                )}
                {currentCatInfo.icon === 'archive' && (
                  <div className="w-full h-full rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Archive className="w-7 h-7" />
                  </div>
                )}
                {currentCatInfo.icon === 'video' && (
                  <div className="w-full h-full rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                    <Film className="w-7 h-7" />
                  </div>
                )}
                {currentCatInfo.icon === 'audio' && (
                  <div className="w-full h-full rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <Music className="w-7 h-7" />
                  </div>
                )}
                {currentCatInfo.icon === 'document' && (
                  <div className="w-full h-full rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <FileText className="w-7 h-7" />
                  </div>
                )}
                {currentCatInfo.icon === 'general' && (
                  <div className="w-full h-full rounded-2xl bg-gray-500/20 border border-gray-500/40 flex items-center justify-center text-gray-400">
                    <Download className="w-7 h-7" />
                  </div>
                )}
              </div>

              {/* Exact File Size Display (Matching Photo 3) */}
              <div className="text-base font-bold text-white tracking-tight font-mono">
                {formatBytes(fileSize)}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">
                {currentCatInfo.typeLabel}
              </div>
            </div>
          </div>

          {/* SADECE VE SADECE MEDYA / VİDEO İSE GÖRÜNEN KALİTE VE FORMAT SEÇİMİ */}
          {/* Non-media (EXE, ZIP, PDF vb.) için bu blok KESİNLİKLE görünmez */}
          {isMedia && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1.5">
                  {formatType === 'mp3' ? <Music className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                  <span>Format ve Kalite Seçimi (Video / Ses)</span>
                </span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {formatType === 'mp3' ? 'Sadece Ses' : 'Video + Ses'}
                </span>
              </div>

              {/* Format Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setFormatType('mp4')}
                  className={`py-1.5 px-2 rounded-lg text-center font-semibold text-[11px] border transition ${
                    formatType === 'mp4'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-[#16181c] text-gray-300 border-[#30363d] hover:bg-[#20242a]'
                  }`}
                >
                  🎥 MP4
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('mkv')}
                  className={`py-1.5 px-2 rounded-lg text-center font-semibold text-[11px] border transition ${
                    formatType === 'mkv'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-[#16181c] text-gray-300 border-[#30363d] hover:bg-[#20242a]'
                  }`}
                >
                  🎬 MKV
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('mp3')}
                  className={`py-1.5 px-2 rounded-lg text-center font-semibold text-[11px] border transition ${
                    formatType === 'mp3'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-[#16181c] text-gray-300 border-[#30363d] hover:bg-[#20242a]'
                  }`}
                >
                  🎵 MP3 (Ses)
                </button>
                <button
                  type="button"
                  onClick={() => setFormatType('webm')}
                  className={`py-1.5 px-2 rounded-lg text-center font-semibold text-[11px] border transition ${
                    formatType === 'webm'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                      : 'bg-[#16181c] text-gray-300 border-[#30363d] hover:bg-[#20242a]'
                  }`}
                >
                  🌐 WebM
                </button>
              </div>

              {/* Quality Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-gray-400">
                  {formatType === 'mp3' ? 'Ses Kalitesi (Bitrate)' : 'Video Çözünürlüğü / Kalite'}
                </label>
                {formatType === 'mp3' ? (
                  <select
                    value={audioQuality}
                    onChange={(e) => setAudioQuality(e.target.value)}
                    className="w-full bg-[#16181c] border border-emerald-800/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="audio-320k">320 kbps (En Yüksek MP3 Kalitesi)</option>
                    <option value="audio-192k">192 kbps (Standart Kalite)</option>
                    <option value="audio-128k">128 kbps (Düşük Boyut / Hafif)</option>
                  </select>
                ) : (
                  <select
                    value={videoQuality}
                    onChange={(e) => setVideoQuality(e.target.value)}
                    className="w-full bg-[#16181c] border border-emerald-800/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="best">En İyi Kalite (Otomatik En Yüksek Çözünürlük)</option>
                    <option value="1080p">1080p (Full HD)</option>
                    <option value="720p">720p (HD)</option>
                    <option value="480p">480p (SD)</option>
                    <option value="360p">360p (Düşük Boyut)</option>
                  </select>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons (Exact Match to Photo 3) */}
          <div className="pt-3 flex items-center justify-between border-t border-[#30363d]">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleStart(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold bg-[#252a30] hover:bg-[#2c323a] text-gray-200 border border-[#3b434e] rounded-xl transition active:scale-95 shadow-sm"
              >
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                <span>Daha Sonra İndir</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleStart(false)}
                className="flex items-center space-x-1.5 px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-950/40 transition active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>İndirmeyi Başlat</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 border border-[#30363d] rounded-xl transition"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
