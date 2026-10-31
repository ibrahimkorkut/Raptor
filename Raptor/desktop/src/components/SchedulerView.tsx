import React, { useState } from 'react';
import { 
  CalendarClock, 
  Power, 
  Clock, 
  CheckCircle2, 
  Save, 
  Radio
} from 'lucide-react';
import { ScheduleRule } from '../types';

interface SchedulerViewProps {
  initialRule: ScheduleRule;
  onSaveRule: (rule: ScheduleRule) => void;
}

export const SchedulerView: React.FC<SchedulerViewProps> = ({ initialRule, onSaveRule }) => {
  const [rule, setRule] = useState<ScheduleRule>(initialRule);
  const [isSaved, setIsSaved] = useState(false);

  const days = [
    { label: 'Mon', val: 1 },
    { label: 'Tue', val: 2 },
    { label: 'Wed', val: 3 },
    { label: 'Thu', val: 4 },
    { label: 'Fri', val: 5 },
    { label: 'Sat', val: 6 },
    { label: 'Sun', val: 0 },
  ];

  const toggleDay = (day: number) => {
    setRule((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
    setIsSaved(false);
  };

  const handleSave = () => {
    onSaveRule(rule);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-900 p-6 select-none max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">Download Scheduler</h1>
              <p className="text-xs text-slate-400 font-mono">
                Automated night downloads, off-peak bandwidth scheduling, and system power off
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setRule((prev) => ({ ...prev, enabled: !prev.enabled }))}
              className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                rule.enabled 
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30' 
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${rule.enabled ? 'animate-pulse text-white' : ''}`} />
              <span>{rule.enabled ? 'SCHEDULER ACTIVE' : 'SCHEDULER DISABLED'}</span>
            </button>
          </div>
        </div>

        {/* Schedule Timing Box */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Time Boundaries</span>
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Start Download At (Night Window):
              </label>
              <input
                type="time"
                value={rule.startTime}
                onChange={(e) => {
                  setRule((prev) => ({ ...prev, startTime: e.target.value }));
                  setIsSaved(false);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800">
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Stop Download At:
              </label>
              <input
                type="time"
                value={rule.stopTime}
                onChange={(e) => {
                  setRule((prev) => ({ ...prev, stopTime: e.target.value }));
                  setIsSaved(false);
                }}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono text-purple-300 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Active Days of the Week:
            </label>
            <div className="flex items-center space-x-2">
              {days.map((d) => {
                const isActive = rule.daysOfWeek.includes(d.val);
                return (
                  <button
                    key={d.val}
                    onClick={() => toggleDay(d.val)}
                    className={`w-10 h-8 rounded-lg text-xs font-mono font-bold transition ${
                      isActive 
                        ? 'bg-purple-600 text-white shadow-sm' 
                        : 'bg-slate-900 text-slate-500 hover:text-slate-300 border border-slate-800'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Post-Completion Automation Action */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Power className="w-4 h-4 text-rose-400" />
            <span>On Queue Completion Actions</span>
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'None', label: 'Do Nothing', desc: 'Leave computer in its current state' },
              { id: 'HangUp', label: 'Disconnect Network', desc: 'Drop network interface to prevent background data usage' },
              { id: 'Exit', label: 'Exit HyperDownload', desc: 'Close application process cleanly' },
              { id: 'Shutdown', label: 'Turn Off Computer (Shutdown)', desc: 'Initiate Windows safe shutdown via ExitWindowsEx' },
            ].map((act) => {
              const isSelected = rule.actionOnComplete === act.id;
              return (
                <div
                  key={act.id}
                  onClick={() => {
                    setRule((prev) => ({ ...prev, actionOnComplete: act.id as any }));
                    setIsSaved(false);
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    isSelected 
                      ? 'bg-purple-950/40 border-purple-500 text-white' 
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`w-3 h-3 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-purple-400 bg-purple-600' : 'border-slate-600'
                    }`}>
                      {isSelected && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </span>
                    <span className="font-semibold text-xs">{act.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 pl-5">{act.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-between pt-2">
          {isSaved ? (
            <span className="text-xs text-emerald-400 flex items-center space-x-1 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Schedule settings saved successfully!</span>
            </span>
          ) : <span />}

          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-purple-600/20 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Schedule</span>
          </button>
        </div>
      </div>
    </div>
  );
};
