import React, { useState } from 'react';
import { 
  ListOrdered, 
  Play, 
  Square, 
  Plus, 
  ArrowUp, 
  ArrowDown, 
  Trash2,
  Layers,
  Settings2
} from 'lucide-react';
import { DownloadQueue, DownloadTask } from '../types';

interface QueuesViewProps {
  queues: DownloadQueue[];
  tasks: DownloadTask[];
  onStartQueue: (queueId: string) => void;
  onStopQueue: (queueId: string) => void;
  onUpdateQueueConcurrency: (queueId: string, maxConcurrent: number) => void;
  onCreateQueue: (name: string) => void;
  onMovePriority: (queueId: string, downloadId: string, direction: 'up' | 'down') => void;
  onRemoveFromQueue: (queueId: string, downloadId: string) => void;
}

export const QueuesView: React.FC<QueuesViewProps> = ({
  queues,
  tasks,
  onStartQueue,
  onStopQueue,
  onUpdateQueueConcurrency,
  onCreateQueue,
  onMovePriority,
  onRemoveFromQueue,
}) => {
  const [selectedQueueId, setSelectedQueueId] = useState<string>(queues[0]?.id || 'main-queue');
  const [newQueueName, setNewQueueName] = useState('');
  const [isAddingQueue, setIsAddingQueue] = useState(false);

  const selectedQueue = queues.find((q) => q.id === selectedQueueId) || queues[0];

  const queuedTasks = selectedQueue
    ? selectedQueue.downloadIds
        .map((id) => tasks.find((t) => t.id === id))
        .filter((t): t is DownloadTask => t !== undefined)
    : [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQueueName.trim()) return;
    onCreateQueue(newQueueName.trim());
    setNewQueueName('');
    setIsAddingQueue(false);
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-900 select-none">
      {/* Left Queue List */}
      <div className="w-64 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <ListOrdered className="w-4 h-4 text-amber-400" />
              <span>Queues</span>
            </h2>
            <button
              onClick={() => setIsAddingQueue(true)}
              className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
              title="Create New Queue"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {isAddingQueue && (
            <form onSubmit={handleCreate} className="p-2 bg-slate-900 border border-slate-700 rounded-lg space-y-2">
              <input
                type="text"
                autoFocus
                placeholder="Queue Name..."
                value={newQueueName}
                onChange={(e) => setNewQueueName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <div className="flex justify-end space-x-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setIsAddingQueue(false)}
                  className="px-2 py-0.5 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded"
                >
                  Create
                </button>
              </div>
            </form>
          )}

          <div className="space-y-1">
            {queues.map((q) => {
              const isSelected = selectedQueue?.id === q.id;
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedQueueId(q.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs font-medium transition ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${q.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                    <span className="truncate">{q.name}</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 text-slate-400">
                    {q.downloadIds.length} items
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
          <p className="font-semibold text-slate-300 mb-0.5">Queue Processing</p>
          Files download sequentially up to the configured concurrency limit.
        </div>
      </div>

      {/* Right Queue Contents & Configuration */}
      {selectedQueue ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header Controls */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-white">{selectedQueue.name}</h1>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                  selectedQueue.isRunning 
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {selectedQueue.isRunning ? 'PROCESSING' : 'STOPPED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {queuedTasks.length} downloads scheduled • Max {selectedQueue.maxConcurrent} active concurrently
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                <Settings2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Max Concurrent:</span>
                <select
                  value={selectedQueue.maxConcurrent}
                  onChange={(e) => onUpdateQueueConcurrency(selectedQueue.id, parseInt(e.target.value) || 1)}
                  className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-amber-400 focus:outline-none"
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>

              {selectedQueue.isRunning ? (
                <button
                  onClick={() => onStopQueue(selectedQueue.id)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/40 rounded-lg text-xs font-semibold shadow transition"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Queue</span>
                </button>
              ) : (
                <button
                  onClick={() => onStartQueue(selectedQueue.id)}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow transition"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Queue</span>
                </button>
              )}
            </div>
          </div>

          {/* Queue Tasks Table */}
          <div className="flex-1 overflow-auto p-4">
            {queuedTasks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Layers className="w-8 h-8 text-slate-600" />
                <p className="text-xs">No downloads in this queue</p>
                <p className="text-[11px] text-slate-600 font-mono">
                  Assign downloads to this queue from the &quot;Add URL&quot; dialog or right-click table menu
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {queuedTasks.map((t, idx) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 bg-slate-950/80 border border-slate-800 rounded-lg hover:border-slate-700 transition"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xs font-mono font-bold text-amber-400 w-6 text-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-xs text-slate-200">{t.fileName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{formatBytes(t.totalBytes)} • {t.status}</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        disabled={idx === 0}
                        onClick={() => onMovePriority(selectedQueue.id, t.id, 'up')}
                        className={`p-1 rounded ${idx === 0 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === queuedTasks.length - 1}
                        onClick={() => onMovePriority(selectedQueue.id, t.id, 'down')}
                        className={`p-1 rounded ${idx === queuedTasks.length - 1 ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <div className="h-4 w-px bg-slate-800 mx-1" />
                      <button
                        onClick={() => onRemoveFromQueue(selectedQueue.id, t.id)}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                        title="Remove From Queue"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
