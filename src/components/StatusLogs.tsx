import { ActivityLog } from '../types';
import { Terminal, CheckCircle2, AlertTriangle, XCircle, Info, Trash2 } from 'lucide-react';

interface StatusLogsProps {
  logs: ActivityLog[];
  onClear: () => void;
}

export default function StatusLogs({ logs, onClear }: StatusLogsProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl" id="diagnostic-logs-panel">
      {/* Header */}
      <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <h3 className="font-mono text-sm font-semibold text-slate-200">
            System & Diagnostics Console
          </h3>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 font-mono transition-colors"
          title="Clear system console logs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear API Logs
        </button>
      </div>

      {/* Logs Viewport */}
      <div className="p-3 max-h-60 overflow-y-auto font-mono text-xs space-y-2 h-44 flex flex-col-reverse justify-end scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {logs.length === 0 ? (
          <div className="text-slate-500 italic text-center py-8">
            Console is clean. Try editing a cell or querying spreadsheet files to see network queries!
          </div>
        ) : (
          [...logs].reverse().map((log) => {
            const isSuccess = log.type === 'success';
            const isError = log.type === 'error';
            const isWarning = log.type === 'warning';

            return (
              <div
                key={log.id}
                className={`p-2 rounded border transition-all ${
                  isError
                    ? 'bg-rose-950/45 border-rose-900/30 text-rose-300'
                    : isSuccess
                    ? 'bg-emerald-950/45 border-emerald-900/30 text-emerald-300'
                    : isWarning
                    ? 'bg-amber-950/45 border-amber-900/30 text-amber-300'
                    : 'bg-slate-950/40 border-slate-800/50 text-slate-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">
                    {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {isError && <XCircle className="w-3.5 h-3.5 text-rose-400" />}
                    {isWarning && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                    {!isSuccess && !isError && !isWarning && <Info className="w-3.5 h-3.5 text-sky-400" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold uppercase tracking-wider text-[10px] ${
                        isError ? 'text-rose-400' : isSuccess ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-sky-400'
                      }`}>
                        [{log.type}]
                      </span>
                      <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                    </div>
                    <p className="mt-1 leading-relaxed break-words">{log.message}</p>
                    {log.details && (
                      <div className="mt-1.5 p-1.5 bg-black/40 rounded border border-black/10 text-slate-400 whitespace-pre-wrap leading-normal font-sans text-[11px]">
                        {log.details}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
