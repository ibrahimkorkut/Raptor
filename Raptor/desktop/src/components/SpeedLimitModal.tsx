import React, { useState, useEffect } from 'react';
import { X, Gauge, Check } from 'lucide-react';
import { RaptorPixelHead } from './RaptorPixelHead';

interface SpeedLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLimitBps: number;
  onApplyLimit: (limitBps: number) => void;
}

export const SpeedLimitModal: React.FC<SpeedLimitModalProps> = ({
  isOpen,
  onClose,
  currentLimitBps,
  onApplyLimit,
}) => {
  const [mode, setMode] = useState<'unlimited' | 'custom'>('unlimited');
  const [customValue, setCustomValue] = useState<string>('5');
  const [unit, setUnit] = useState<'MB' | 'KB'>('MB');

  useEffect(() => {
    if (isOpen) {
      if (currentLimitBps === 0) {
        setMode('unlimited');
        setCustomValue('5');
        setUnit('MB');
      } else {
        setMode('custom');
        if (currentLimitBps >= 1024 * 1024) {
          setUnit('MB');
          const mbVal = currentLimitBps / (1024 * 1024);
          setCustomValue(Number.isInteger(mbVal) ? mbVal.toString() : mbVal.toFixed(1));
        } else {
          setUnit('KB');
          setCustomValue(Math.round(currentLimitBps / 1024).toString());
        }
      }
    }
  }, [isOpen, currentLimitBps]);

  if (!isOpen) return null;

  const presets = [
    { label: 'Sınırsız', bps: 0 },
    { label: '1 MB/s', bps: 1024 * 1024 },
    { label: '2.5 MB/s', bps: 2.5 * 1024 * 1024 },
    { label: '5 MB/s', bps: 5 * 1024 * 1024 },
    { label: '10 MB/s', bps: 10 * 1024 * 1024 },
    { label: '25 MB/s', bps: 25 * 1024 * 1024 },
    { label: '50 MB/s', bps: 50 * 1024 * 1024 },
  ];

  const handleApply = () => {
    if (mode === 'unlimited') {
      onApplyLimit(0);
    } else {
      const num = parseFloat(customValue.replace(',', '.'));
      if (isNaN(num) || num <= 0) {
        onApplyLimit(0);
      } else {
        const multiplier = unit === 'MB' ? 1024 * 1024 : 1024;
        const limitBps = Math.round(num * multiplier);
        onApplyLimit(limitBps);
      }
    }
    onClose();
  };

  const handleSelectPreset = (bps: number) => {
    if (bps === 0) {
      setMode('unlimited');
    } else {
      setMode('custom');
      const mb = bps / (1024 * 1024);
      setUnit('MB');
      setCustomValue(mb.toString());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gray-50/80 px-5 py-4 border-b border-gray-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#dcfce7] flex items-center justify-center text-[#15803d]">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">İndirme Hız Sınırı (Speed Limiter)</h2>
              <p className="text-[11px] text-gray-500">Bant genişliğini kontrol edin veya sınırsız indirin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 text-xs">
          {/* Mode Selection */}
          <div className="space-y-2">
            <label
              onClick={() => setMode('unlimited')}
              className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                mode === 'unlimited'
                  ? 'border-[#1b4327] bg-[#f0fdf4] text-gray-900 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <input
                type="radio"
                name="speedMode"
                checked={mode === 'unlimited'}
                onChange={() => setMode('unlimited')}
                className="mt-0.5 text-[#1b4327] focus:ring-0 w-4 h-4"
              />
              <div className="flex-1">
                <div className="flex items-center space-x-1.5 font-semibold">
                  <RaptorPixelHead className="w-4 h-3.5" color="#059669" eyeColor="#064e3b" />
                  <span>Sınırsız Hız (Unlimited)</span>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  İnternet bağlantınızın sunabildiği maksimum hızda indirme yapılır.
                </p>
              </div>
            </label>

            <label
              onClick={() => setMode('custom')}
              className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer transition ${
                mode === 'custom'
                  ? 'border-[#1b4327] bg-[#f0fdf4] text-gray-900 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
              }`}
            >
              <input
                type="radio"
                name="speedMode"
                checked={mode === 'custom'}
                onChange={() => setMode('custom')}
                className="mt-0.5 text-[#1b4327] focus:ring-0 w-4 h-4"
              />
              <div className="flex-1">
                <div className="font-semibold">Özel Hız Sınırı Belirle (Custom Limit)</div>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Diğer uygulamalar için bant genişliği ayırmak istediğinizde sınırlayın.
                </p>
              </div>
            </label>
          </div>

          {/* Custom Input Box (Shown when Custom is selected) */}
          {mode === 'custom' && (
            <div className="space-y-3 p-3 bg-gray-50/70 rounded-xl border border-gray-200/80">
              <label className="text-[11px] font-semibold text-gray-700 block">
                Maksimum İndirme Hızı:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="5"
                  className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-semibold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1b4327] focus:border-transparent transition"
                  autoFocus
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as 'MB' | 'KB')}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1b4327] transition"
                >
                  <option value="MB">MB/s</option>
                  <option value="KB">KB/s</option>
                </select>
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-gray-500 block">Hızlı Seçim:</span>
            <div className="grid grid-cols-4 gap-1.5">
              {presets.map((p) => {
                const isSelected =
                  (p.bps === 0 && mode === 'unlimited') ||
                  (p.bps > 0 &&
                    mode === 'custom' &&
                    unit === 'MB' &&
                    parseFloat(customValue) === p.bps / (1024 * 1024));
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleSelectPreset(p.bps)}
                    className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium transition ${
                      isSelected
                        ? 'bg-[#1b4327] text-white border-[#1b4327]'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50/80 px-5 py-3 border-t border-gray-200/80 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-200/60 transition"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#1b4327] hover:bg-[#15341f] text-white shadow-sm flex items-center space-x-1.5 transition active:scale-[0.98]"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Uygula ve Kaydet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
