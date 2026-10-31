import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Folder, 
  Gauge, 
  ClipboardCheck, 
  Folders, 
  Power, 
  Bell, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Server
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  // Load saved settings or defaults
  const [downloadDir, setDownloadDir] = useState<string>(() => {
    return localStorage.getItem('raptor_download_dir') || 'C:\\Users\\ibrahim\\Downloads';
  });
  const [defaultConnections, setDefaultConnections] = useState<number>(() => {
    return parseInt(localStorage.getItem('raptor_default_connections') || '8');
  });
  const [clipboardMonitor, setClipboardMonitor] = useState<boolean>(() => {
    return localStorage.getItem('raptor_clipboard_monitor') !== 'false';
  });
  const [autoCategorize, setAutoCategorize] = useState<boolean>(() => {
    return localStorage.getItem('raptor_auto_categorize') !== 'false';
  });
  const [startWithWindows, setStartWithWindows] = useState<boolean>(() => {
    return localStorage.getItem('raptor_start_windows') !== 'false';
  });
  const [notifications, setNotifications] = useState<boolean>(() => {
    return localStorage.getItem('raptor_notifications') !== 'false';
  });
  
  // Advanced hidden by default
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [bridgePort, setBridgePort] = useState<number>(() => {
    return parseInt(localStorage.getItem('raptor_bridge_port') || '9145');
  });
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setIsSaved(false);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('raptor_download_dir', downloadDir);
    localStorage.setItem('raptor_default_connections', defaultConnections.toString());
    localStorage.setItem('raptor_clipboard_monitor', clipboardMonitor.toString());
    localStorage.setItem('raptor_auto_categorize', autoCategorize.toString());
    localStorage.setItem('raptor_start_windows', startWithWindows.toString());
    localStorage.setItem('raptor_notifications', notifications.toString());
    localStorage.setItem('raptor_bridge_port', bridgePort.toString());

    setIsSaved(true);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#111612] border border-[#233526] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#1c261e] flex items-center justify-between bg-[#151c16]/80">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Raptor Ayarları</h2>
              <p className="text-[11px] text-gray-400">İndirme motoru, klasörler ve otomasyon tercihleri</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition"
            title="Kapat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 text-xs overflow-y-auto custom-scrollbar">
          
          {/* Section 1: İndirme Klasörü */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              <span>Varsayılan İndirme Konumu</span>
            </label>
            <div className="flex items-center gap-2 bg-[#0d120e] p-2 rounded-xl border border-[#1e2c20]">
              <input
                type="text"
                value={downloadDir}
                onChange={(e) => setDownloadDir(e.target.value)}
                className="bg-transparent flex-1 text-slate-200 text-xs px-2 py-1 outline-none font-mono"
                placeholder="Örn: C:\Users\Kullanıcı\Downloads"
              />
              <button
                type="button"
                onClick={() => {
                  const defaultPath = 'C:\\Users\\' + (navigator.userAgent.includes('Windows') ? 'Kullanıcı' : 'user') + '\\Downloads';
                  const newPath = prompt('Lütfen yeni indirme klasörü yolunu girin:', downloadDir || defaultPath);
                  if (newPath && newPath.trim()) setDownloadDir(newPath.trim());
                }}
                className="px-3 py-1.5 bg-[#1b2f1e] hover:bg-[#233d27] text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition"
              >
                Gözat
              </button>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              İnternetten veya tarayıcıdan yakalanan tüm dosyalar doğrudan bu klasöre indirilir.
            </p>
          </div>

          {/* Section 2: Hız & Eşzamanlı Bağlantı */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              <span>İndirme Hızlandırma & Parça Sayısı</span>
            </label>
            <div className="flex items-center justify-between bg-[#0d120e] p-3 rounded-xl border border-[#1e2c20]">
              <div>
                <div className="font-semibold text-slate-200">Eşzamanlı Bağlantı (Parça) Sayısı</div>
                <div className="text-[11px] text-gray-400">Dosya başına açılan maksimum paralel indirme hattı</div>
              </div>
              <select
                value={defaultConnections}
                onChange={(e) => setDefaultConnections(parseInt(e.target.value))}
                className="bg-[#151c16] border border-[#233526] rounded-lg px-3 py-1.5 text-slate-200 text-xs font-semibold outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value={1}>1 Parça (Standart Hız)</option>
                <option value={4}>4 Parça (Hafif Ağlar)</option>
                <option value={8}>8 Parça (Önerilen Hız)</option>
                <option value={16}>16 Parça (Maksimum Performans)</option>
                <option value={32}>32 Parça (Fiber & Yüksek Hat)</option>
              </select>
            </div>
          </div>

          {/* Section 3: Otomasyon ve Kolaylıklar */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Folders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Otomasyon & Bildirimler</span>
            </label>

            {/* Pano Takibi */}
            <div className="flex items-center justify-between bg-[#0d120e] p-3 rounded-xl border border-[#1e2c20]">
              <div className="pr-4">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Kopyalanan İndirme Linklerini Otomatik Yakala</span>
                </div>
                <div className="text-[11px] text-gray-400">Panoya (Ctrl+C) bir dosya/video linki aldığınızda indirme penceresini hazırla</div>
              </div>
              <input
                type="checkbox"
                checked={clipboardMonitor}
                onChange={(e) => setClipboardMonitor(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-[#151c16] border-[#233526] accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Otomatik Kategorilendirme */}
            <div className="flex items-center justify-between bg-[#0d120e] p-3 rounded-xl border border-[#1e2c20]">
              <div className="pr-4">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Folders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dosyaları Türüne Göre Otomatik Sırala</span>
                </div>
                <div className="text-[11px] text-gray-400">Videoları "Video", arşivleri "Arşiv", belgeleri "Belgeler" klasörüne grupla</div>
              </div>
              <input
                type="checkbox"
                checked={autoCategorize}
                onChange={(e) => setAutoCategorize(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-[#151c16] border-[#233526] accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Windows Başlangıcı */}
            <div className="flex items-center justify-between bg-[#0d120e] p-3 rounded-xl border border-[#1e2c20]">
              <div className="pr-4">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Power className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Windows Açılışında Otomatik Başlat</span>
                </div>
                <div className="text-[11px] text-gray-400">Bilgisayar açıldığında arka planda hazır bekleyerek tarayıcı indirmelerini anında yakala</div>
              </div>
              <input
                type="checkbox"
                checked={startWithWindows}
                onChange={(e) => setStartWithWindows(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-[#151c16] border-[#233526] accent-emerald-500 cursor-pointer"
              />
            </div>

            {/* Bildirimler */}
            <div className="flex items-center justify-between bg-[#0d120e] p-3 rounded-xl border border-[#1e2c20]">
              <div className="pr-4">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-emerald-400" />
                  <span>İndirme Tamamlandığında Bildirim Göster</span>
                </div>
                <div className="text-[11px] text-gray-400">Dosya veya video indiğinde ekranda tamamlandı bildirimi göster</div>
              </div>
              <input
                type="checkbox"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-[#151c16] border-[#233526] accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Section 4: Gelişmiş Ağ Ayarları (İleri Düzey - Katlanabilir) */}
          <div className="border-t border-[#1c261e] pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between text-gray-400 hover:text-slate-200 transition text-[11px] font-semibold py-1"
            >
              <div className="flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-gray-400" />
                <span>Gelişmiş Ağ ve Port Ayarları (İleri Düzey)</span>
              </div>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showAdvanced && (
              <div className="mt-2.5 bg-[#0a0f0b] p-3 rounded-xl border border-[#1e2c20] space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-slate-300">Tarayıcı Entegrasyon Portu</div>
                    <div className="text-[10px] text-gray-400">Chrome ve Edge eklentisi için dinleme portu (Varsayılan: 9145)</div>
                  </div>
                  <input
                    type="number"
                    value={bridgePort}
                    onChange={(e) => setBridgePort(parseInt(e.target.value) || 9145)}
                    className="w-20 bg-[#111612] border border-[#233526] rounded px-2.5 py-1 text-slate-200 text-xs font-mono text-center outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                  ⚠️ Bu portu yalnızca ağ çakışması durumunda değiştiriniz. Değişiklik sonrası eklenti ve uygulama yeniden başlatılmalıdır.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-3.5 bg-[#151c16]/80 border-t border-[#1c261e] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaved}
            className={`px-5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-md ${
              isSaved
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Kaydedildi!</span>
              </>
            ) : (
              <span>Ayarları Kaydet</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
