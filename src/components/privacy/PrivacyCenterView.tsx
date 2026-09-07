import React, { useState } from 'react';
import {
  ShieldCheck,
  Download,
  Lock,
  FileText,
  Brain,
  Image as ImageIcon,
  Mic,
  Target,
  Sparkles,
  AlertTriangle,
  X,
  History,
  FileJson,
  FileCode,
  Table,
  Info,
} from 'lucide-react';
import type { JournalEntry, Memory, Goal, Habit } from '../../data/models';
import type { JournalInteraction } from '../../types';
import {
  deleteAllJournalEntries,
  deleteAllMemories,
  deleteAllUserData,
} from '../../services/privacyGovernance';
import { getPrivacyMetrics } from '../../services/privacyService';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/TextField';
import { DataExportModal } from './DataExportModal';

export interface PrivacyCenterViewProps {
  entries: JournalEntry[];
  memories: Memory[];
  goals: Goal[];
  habits?: Habit[];
  currentUserId: string;
  /** Hides destructive/export actions — demo sessions cannot touch Firestore. */
  isDemo?: boolean;
  /** AI companion session history (`/users/{uid}/interactions`) for the honest AI Conversations count. */
  aiSessions?: JournalInteraction[];
}

type DeleteTarget = 'journal' | 'memories' | 'all';
type BusyTarget = DeleteTarget | null;
type Notice = { kind: 'success' | 'error'; text: string } | null;

const CONFIRM_LABEL = 'DELETE';

export const PrivacyCenterView: React.FC<PrivacyCenterViewProps> = ({
  entries,
  memories,
  goals,
  habits = [],
  currentUserId,
  isDemo = false,
  aiSessions = [],
}) => {
  const metrics = getPrivacyMetrics({ entries, memories, goals, currentUserId });

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<DeleteTarget | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [busyTarget, setBusyTarget] = useState<BusyTarget>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const aiConversationCount = aiSessions.filter((s) => s.userId === currentUserId).length;
  const isInputConfirmed = confirmInput.trim() === CONFIRM_LABEL;

  const openConfirm = (target: DeleteTarget) => {
    setConfirmInput('');
    setConfirmTarget(target);
  };

  const closeConfirm = () => {
    if (busyTarget) return;
    setConfirmInput('');
    setConfirmTarget(null);
  };

  const performDelete = async () => {
    if (!confirmTarget || busyTarget) return;
    if (confirmInput.trim() !== CONFIRM_LABEL) return;

    setBusyTarget(confirmTarget);
    setNotice(null);
    try {
      const results =
        confirmTarget === 'journal'
          ? [await deleteAllJournalEntries()]
          : confirmTarget === 'memories'
            ? [await deleteAllMemories()]
            : await deleteAllUserData();

      const deleted = results.reduce((acc, r) => acc + r.deleted, 0);
      const failed = results.reduce((acc, r) => acc + r.failed, 0);

      if (failed > 0) {
        setNotice({
          kind: 'error',
          text: `Deletion incomplete — ${failed} item(s) could not be removed. Check your connection and retry.`,
        });
      } else if (confirmTarget === 'journal') {
        setNotice({
          kind: 'success',
          text: `${deleted} journal entr${deleted === 1 ? 'y' : 'ies'} permanently deleted from your JOURNAL∞ account data.`,
        });
      } else if (confirmTarget === 'memories') {
        setNotice({
          kind: 'success',
          text: `${deleted} AI memor${deleted === 1 ? 'y' : 'ies'} permanently deleted from your JOURNAL∞ account data.`,
        });
      } else {
        setNotice({
          kind: 'success',
          text: `Every record (${deleted} across ${results.length} collections) was permanently deleted from your JOURNAL∞ account data. Your Google login was not affected.`,
        });
      }
      setConfirmTarget(null);
      setConfirmInput('');
    } catch (err) {
      setNotice({
        kind: 'error',
        text: `Deletion failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      });
    } finally {
      setBusyTarget(null);
    }
  };

  const confirmMeta: Record<DeleteTarget, { title: string; consequence: string }> = {
    journal: {
      title: 'Delete all journal entries?',
      consequence: `This permanently deletes ${metrics.journalEntryCount} journal entr${metrics.journalEntryCount === 1 ? 'y' : 'ies'} (bodies, tags, attachments metadata, and reflection modes) from your isolated Firestore partition. This cannot be undone.`,
    },
    memories: {
      title: 'Delete all AI memories?',
      consequence: `This permanently deletes ${metrics.memoryCount} memor${metrics.memoryCount === 1 ? 'y' : 'ies'} held in your AI memory bank. This cannot be undone.`,
    },
    all: {
      title: 'Delete absolutely everything?',
      consequence:
        'This permanently deletes journal entries, memories, conversations, goals, habits, collections, timeline events, insights, AI conversations, preferences, and notifications from your journal data. This cannot be undone. It does NOT delete your Google login.',
    },
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
          You control your personal journal data. We never sell your entries, and private thoughts are never used to train public AI models. Deletions here are permanent Firestore operations scoped strictly to your own account.
        </p>
      </div>

      {isDemo && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2" role="note">
          <Info className="w-4 h-4 shrink-0 mt-px" />
          <span>
            You are exploring in demo mode. Demo sessions never write to Firestore, so exporting or permanently deleting your data is only available after signing in with Google.
          </span>
        </div>
      )}

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            notice.kind === 'error'
              ? 'bg-rose-950/60 border-rose-500/30 text-rose-300'
              : 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <span>{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
            className="shrink-0 text-current/70 hover:text-white min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
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
              <History className="w-4 h-4 text-indigo-400" />
              <span>AI Conversations</span>
            </div>
            <div className="text-xl font-bold text-slate-100">{aiConversationCount}</div>
          </div>
        </div>
      </div>

      {/* Honest data-used explainer (replaces the cosmetic, un-honored toggles) */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-slate-200">
          <Lock className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-semibold">How your data is used</h3>
        </div>
        <ul className="space-y-2 text-xs text-slate-400 list-disc pl-4">
          <li>
            Everything you write is stored in your own private Firebase partition (<code>users/&#123;uid&#125;</code>) and isolated by security rules.
          </li>
          <li>
            Entries flagged <em>Private</em> are excluded from memories, timeline, and insights — but remain part of your AI context for features that process your entries, and are always included in your own exports.
          </li>
          <li>
            Your reflections are processed by Gemini to power companion modes, memory suggestions, and “Ask My Life”. No third party can read or index your journal.
          </li>
          <li>
            We do not sell your data, and your journal is never used to train public AI models.
          </li>
        </ul>
      </div>

      {!isDemo && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Export Data Card */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-200">
                <Download className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold">Data Portability</h3>
              </div>
              <p className="text-xs text-slate-400">
                Download everything that belongs to your account — journal entries, memories, goals, habits, and AI conversations — in <FileJson className="inline w-3 h-3" /> JSON, <FileCode className="inline w-3 h-3" /> Markdown, or <Table className="inline w-3 h-3" /> CSV. Every export is integrity-verified before download, and only your own records are included.
              </p>
            </div>
            <Button
              variant="primary"
              fullWidth
              icon={<Download className="w-4 h-4" />}
              onClick={() => setIsExportOpen(true)}
            >
              Export My Data
            </Button>
          </div>

          {/* Destructive Actions */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-200">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-semibold">Permanent Data Deletion</h3>
              </div>
              <p className="text-xs text-slate-400">
                Delete your journal entries, AI memories, or everything you have stored in JOURNAL∞. Each action permanently removes those records from your Firestore partition and cannot be undone — but deleting them never affects your Google login.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button variant="subtle" size="sm" onClick={() => openConfirm('journal')}>
                Delete Entries
              </Button>
              <Button variant="subtle" size="sm" onClick={() => openConfirm('memories')}>
                Delete Memories
              </Button>
              <Button variant="danger" size="sm" onClick={() => openConfirm('all')}>
                Delete Everything
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export dialog */}
      {!isDemo && (
        <DataExportModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          entries={entries}
          memories={memories}
          goals={goals}
          habits={habits}
          interactions={aiSessions}
          currentUserId={currentUserId}
        />
      )}

      {/* Typed-confirmation destructive dialog */}
      <Dialog
        isOpen={confirmTarget !== null}
        onClose={closeConfirm}
        title={confirmTarget ? confirmMeta[confirmTarget].title : ''}
        description="This action cannot be undone."
        icon={<AlertTriangle className="h-5 w-5 text-rose-400" />}
        iconClassName="border-rose-800/40 bg-rose-950/60 text-rose-400"
        size="sm"
        footer={
          <>
            <Button variant="subtle" size="sm" onClick={closeConfirm} disabled={busyTarget !== null}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busyTarget !== null}
              disabled={!isInputConfirmed}
              onClick={() => void performDelete()}
            >
              Confirm Deletion
            </Button>
          </>
        }
      >
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            {confirmTarget ? confirmMeta[confirmTarget].consequence : ''}
          </p>
          <Input
            label="Type DELETE to confirm"
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder="DELETE"
            aria-label="Type DELETE to confirm permanent deletion"
            disabled={busyTarget !== null}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default PrivacyCenterView;