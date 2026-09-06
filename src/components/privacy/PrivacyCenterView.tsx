import React, { useState } from 'react';
import {
  ShieldCheck,
  Download,
  Trash2,
  Lock,
  FileText,
  Brain,
  Image as ImageIcon,
  Mic,
  Target,
  Sparkles,
  AlertTriangle,
  Eye,
  Check,
  X,
  History,
} from 'lucide-react';
import type { JournalEntry, Memory, Goal, Habit } from '../../data/models';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import {
  getPrivacyMetrics,
  exportUserDataPayload,
  deleteUserMemories,
  deleteUserJournalData,
  deleteUserAccountData,
  type UserAiControls,
} from '../../services/privacyService';

export interface PrivacyCenterViewProps {
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  habits?: Habit[];
  currentUserId: string;
  onUpdateEntries?: (newEntries: JournalEntry[]) => void;
  onUpdateMemories?: (newMemories: Memory[]) => void;
  onUpdateGoals?: (newGoals: Goal[]) => void;
  onAccountDeleted?: () => void;
}

export const PrivacyCenterView: React.FC<PrivacyCenterViewProps> = ({
  entries,
  memories,
  goals,
  habits = [],
  currentUserId,
  onUpdateEntries,
  onUpdateMemories,
  onUpdateGoals,
  onAccountDeleted,
}) => {
  const metrics = getPrivacyMetrics({ entries, memories, goals, currentUserId });

  // AI Controls state
  const [aiControls, setAiControls] = useState<UserAiControls>({
    enableAiAssistance: true,
    enableMemorySuggestions: true,
    enableHistoricalContext: true,
    enableContextualReflections: true,
    excludePrivateEntriesFromAi: true,
  });

  // Modal confirmation states
  const [activeModal, setActiveModal] = useState<'memories' | 'journal' | 'account' | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const handleExportData = () => {
    const payload = exportUserDataPayload({ entries, memories, goals, habits, currentUserId });
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `JOURNAL_LIFE_EXPORT_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStatusNotice('Your personal data export has been downloaded successfully.');
  };

  const handleConfirmDeleteMemories = () => {
    const remaining = deleteUserMemories({ memories, currentUserId, confirmed: true });
    if (onUpdateMemories) onUpdateMemories(remaining);
    setActiveModal(null);
    setStatusNotice('All AI memories have been permanently deleted.');
  };

  const handleConfirmDeleteJournal = () => {
    const remaining = deleteUserJournalData({ entries, currentUserId, confirmed: true });
    if (onUpdateEntries) onUpdateEntries(remaining);
    setActiveModal(null);
    setStatusNotice('All journal entries and attached media have been permanently deleted.');
  };

  const handleConfirmDeleteAccount = () => {
    if (confirmInput.trim().toUpperCase() !== 'DELETE') {
      return;
    }
    const { remainingEntries, remainingMemories, remainingGoals, remainingHabits } = deleteUserAccountData({
      entries,
      memories,
      goals,
      habits,
      currentUserId,
      confirmed: true,
    });

    if (onUpdateEntries) onUpdateEntries(remainingEntries);
    if (onUpdateMemories) onUpdateMemories(remainingMemories);
    if (onUpdateGoals) onUpdateGoals(remainingGoals);
    if (onAccountDeleted) onAccountDeleted();

    setActiveModal(null);
    setStatusNotice('Your account data has been completely wiped from JOURNAL∞.');
  };

  const toggleControl = (key: keyof UserAiControls) => {
    setAiControls((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/20 shadow-xl space-y-2">
        <div className="flex items-center gap-2 text-emerald-400">
          <ShieldCheck className="w-6 h-6" />
          <h2 className="text-xl font-bold tracking-wide">Privacy & Data Governance Center</h2>
        </div>
        <p className="text-xs text-slate-300">
          You have full control over your personal journal data. We never sell your entries or use your private thoughts to train public AI models.
        </p>
      </div>

      {statusNotice && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{statusNotice}</span>
          <button onClick={() => setStatusNotice(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Data Inventory Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300 tracking-wide uppercase">Your Data Inventory</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <FileText className="w-4 h-4 text-purple-400" />
              <span>Entries</span>
            </div>
            <div className="text-xl font-bold text-slate-100">{metrics.journalEntryCount}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Brain className="w-4 h-4 text-amber-400" />
              <span>Memories</span>
            </div>
            <div className="text-xl font-bold text-slate-100">{metrics.memoryCount}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ImageIcon className="w-4 h-4 text-sky-400" />
              <span>Media</span>
            </div>
            <div className="text-xl font-bold text-slate-100">{metrics.uploadedMediaCount}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Mic className="w-4 h-4 text-rose-400" />
              <span>Voice</span>
            </div>
            <div className="text-xl font-bold text-slate-100">{metrics.voiceDataCount}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Target className="w-4 h-4 text-emerald-400" />
              <span>Goals</span>
            </div>
            <div className="text-xl font-bold text-slate-100">{metrics.goalsCount}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>AI Logs</span>
            </div>
            <div className="text-xl font-bold text-slate-100">{metrics.aiInteractionsCount}</div>
          </div>
        </div>
      </div>

      {/* AI Controls */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-slate-200">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-semibold">Gemini AI Privacy Controls</h3>
        </div>

        <div className="space-y-3 divide-y divide-slate-800/80">
          <div className="flex items-center justify-between pt-2">
            <div>
              <div className="text-xs font-medium text-slate-200">AI Writing & Reflection Assistance</div>
              <div className="text-[11px] text-slate-400">Allow Gemini companion modes (Reflect, Challenge, Coach)</div>
            </div>
            <button
              onClick={() => toggleControl('enableAiAssistance')}
              className={`w-11 h-6 rounded-full p-1 transition ${aiControls.enableAiAssistance ? 'bg-purple-600' : 'bg-slate-800'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition transform ${aiControls.enableAiAssistance ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="text-xs font-medium text-slate-200">Memory Candidate Extraction</div>
              <div className="text-[11px] text-slate-400">Allow Gemini to propose key memories for your manual review</div>
            </div>
            <button
              onClick={() => toggleControl('enableMemorySuggestions')}
              className={`w-11 h-6 rounded-full p-1 transition ${aiControls.enableMemorySuggestions ? 'bg-purple-600' : 'bg-slate-800'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition transform ${aiControls.enableMemorySuggestions ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="text-xs font-medium text-slate-200">Historical Journal Context ("Ask My Life")</div>
              <div className="text-[11px] text-slate-400">Allow AI to search past entries to answer your personal questions</div>
            </div>
            <button
              onClick={() => toggleControl('enableHistoricalContext')}
              className={`w-11 h-6 rounded-full p-1 transition ${aiControls.enableHistoricalContext ? 'bg-purple-600' : 'bg-slate-800'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition transform ${aiControls.enableHistoricalContext ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <div className="text-xs font-medium text-slate-200">Exclude Private Entries from AI Context</div>
              <div className="text-[11px] text-slate-400">Never pass entries flagged as "Private" to Gemini AI APIs</div>
            </div>
            <button
              onClick={() => toggleControl('excludePrivateEntriesFromAi')}
              className={`w-11 h-6 rounded-full p-1 transition ${aiControls.excludePrivateEntriesFromAi ? 'bg-purple-600' : 'bg-slate-800'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition transform ${aiControls.excludePrivateEntriesFromAi ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Portability & Destructive Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Export Data Card */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-slate-200">
              <Download className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-semibold">Data Portability</h3>
            </div>
            <p className="text-xs text-slate-400">
              Download your complete journal history, memories, goals, and settings in structured JSON format anytime.
            </p>
          </div>
          <button
            onClick={handleExportData}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Download className="w-4 h-4" />
            <span>Export My Data (JSON)</span>
          </button>
        </div>

      </div>


    </div>
  );
};
