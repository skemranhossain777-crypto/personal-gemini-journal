import React, { useState } from 'react';
import { Download, FileCode, FileText, Table, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import type { JournalEntry, Memory, Goal, Habit } from '../../data/models';
import {
  exportJournalDataAsync,
  verifyExportIntegrity,
  type ExportFormat,
  type ExportResult,
} from '../../services/dataExportService';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';

export interface DataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
  habits?: Habit[];
  currentUserId: string;
}

export const DataExportModal: React.FC<DataExportModalProps> = ({
  isOpen,
  onClose,
  entries,
  memories = [],
  goals = [],
  habits = [],
  currentUserId,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  const handleStartExport = async () => {
    try {
      setIsExporting(true);
      setProgressPercent(0);
      setExportResult(null);
      setErrorMsg(null);
      setIsVerified(false);

      const result = await exportJournalDataAsync({
        entries,
        memories,
        goals,
        habits,
        currentUserId,
        format: selectedFormat,
        onProgress: (pct) => setProgressPercent(pct),
      });

      // Verify downloaded content integrity
      const valid = verifyExportIntegrity(result.content, result.format);
      setIsVerified(valid);
      setExportResult(result);

      // Trigger browser download
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Export Personal Journal Archive"
      description="Export your data strictly under your user account. Zero system credentials or foreign data included."
      icon={<Download className="h-5 w-5 text-emerald-400" />}
      iconClassName="bg-emerald-950/60 border border-emerald-800/40"
      footer={
        <>
          <Button variant="subtle" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={isExporting}
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={handleStartExport}
            className="bg-emerald-600 hover:bg-emerald-500 border-emerald-600"
          >
            Generate & Download
          </Button>
        </>
      }
    >
      <div className="space-y-5 p-6">
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-800 bg-rose-950/60 p-3 text-xs text-rose-300" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Format Selection Cards */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Select Export Format</label>
          <div className="grid grid-cols-3 gap-2" aria-label="Export format options">
            <button
              type="button"
              aria-pressed={selectedFormat === 'json'}
              onClick={() => setSelectedFormat('json')}
              className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 min-h-[44px] ${
                selectedFormat === 'json'
                  ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300 shadow-md'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="mb-2 h-5 w-5 text-emerald-400" />
              <div>
                <div className="text-xs font-bold">JSON</div>
                <div className="text-[10px] text-slate-400">Complete Backup</div>
              </div>
            </button>

            <button
              type="button"
              aria-pressed={selectedFormat === 'markdown'}
              onClick={() => setSelectedFormat('markdown')}
              className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 min-h-[44px] ${
                selectedFormat === 'markdown'
                  ? 'border-purple-500 bg-purple-950/50 text-purple-300 shadow-md'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="mb-2 h-5 w-5 text-purple-400" />
              <div>
                <div className="text-xs font-bold">Markdown</div>
                <div className="text-[10px] text-slate-400">Obsidian / Notion</div>
              </div>
            </button>

            <button
              type="button"
              aria-pressed={selectedFormat === 'csv'}
              onClick={() => setSelectedFormat('csv')}
              className={`flex flex-col justify-between rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 min-h-[44px] ${
                selectedFormat === 'csv'
                  ? 'border-sky-500 bg-sky-950/50 text-sky-300 shadow-md'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Table className="mb-2 h-5 w-5 text-sky-400" />
              <div>
                <div className="text-xs font-bold">CSV</div>
                <div className="text-[10px] text-slate-400">Excel / Spreadsheets</div>
              </div>
            </button>
          </div>
        </div>

        {/* Async Progress Indicator */}
        {isExporting && (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3" aria-live="polite">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                <span>Processing Large Journal Export...</span>
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-1.5 bg-emerald-500 transition-all duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Verification Success Badge */}
        {exportResult && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300" aria-live="polite">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <div>
                <div className="font-semibold">{exportResult.filename} Generated</div>
                <div className="text-[10px] text-emerald-400/80">
                  {exportResult.itemCount} items exported • Verified Data Integrity ({isVerified ? 'Passed' : 'Pending'})
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export default DataExportModal;
