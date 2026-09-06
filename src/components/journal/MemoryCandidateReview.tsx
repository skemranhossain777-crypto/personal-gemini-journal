import React, { useState } from 'react';
import {
  Brain,
  Check,
  X,
  Edit2,
  Sparkles,
  ShieldCheck,
  Star,
  User,
  MapPin,
  FolderGit2,
  Target,
  Award,
  Calendar,
  Lightbulb,
  Heart,
  BookOpen,
  Flag,
  RotateCcw,
} from 'lucide-react';
import type { MemoryType } from '../../data/models';
import type { MemoryCandidate } from '../../../server/gemini/types';

interface MemoryCandidateReviewProps {
  candidates: MemoryCandidate[];
  sourceEntryId?: string;
  onSaveCandidate: (candidate: MemoryCandidate) => Promise<void>;
  onIgnoreCandidate: (candidate: MemoryCandidate) => void;
  onEditCandidate?: (candidate: MemoryCandidate, updated: MemoryCandidate) => void;
  className?: string;
}

export const MEMORY_TYPE_CONFIG: Record<
  MemoryType,
  { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string }
> = {
  person: { label: 'Person', icon: User, colorClass: 'text-pink-400 bg-pink-950/40 border-pink-800/40' },
  place: { label: 'Place', icon: MapPin, colorClass: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' },
  project: { label: 'Project', icon: FolderGit2, colorClass: 'text-blue-400 bg-blue-950/40 border-blue-800/40' },
  goal: { label: 'Goal', icon: Target, colorClass: 'text-amber-400 bg-amber-950/40 border-amber-800/40' },
  achievement: { label: 'Achievement', icon: Award, colorClass: 'text-purple-400 bg-purple-950/40 border-purple-800/40' },
  'important-event': { label: 'Event', icon: Calendar, colorClass: 'text-red-400 bg-red-950/40 border-red-800/40' },
  idea: { label: 'Idea', icon: Lightbulb, colorClass: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/40' },
  preference: { label: 'Preference', icon: Heart, colorClass: 'text-rose-400 bg-rose-950/40 border-rose-800/40' },
  lesson: { label: 'Lesson', icon: BookOpen, colorClass: 'text-indigo-400 bg-indigo-950/40 border-indigo-800/40' },
  milestone: { label: 'Milestone', icon: Flag, colorClass: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/40' },
  'recurring-theme': { label: 'Recurring Theme', icon: RotateCcw, colorClass: 'text-teal-400 bg-teal-950/40 border-teal-800/40' },
};

export const MemoryCandidateReview: React.FC<MemoryCandidateReviewProps> = ({
  candidates,
  sourceEntryId,
  onSaveCandidate,
  onIgnoreCandidate,
  onEditCandidate,
  className = '',
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNarrative, setEditNarrative] = useState('');
  const [editType, setEditType] = useState<MemoryType>('idea');
  const [editImportance, setEditImportance] = useState(3);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(new Set());
  const [ignoredIndices, setIgnoredIndices] = useState<Set<number>>(new Set());

  if (!candidates || candidates.length === 0) return null;

  const startEdit = (idx: number, c: MemoryCandidate) => {
    setEditingIndex(idx);
    setEditTitle(c.title);
    setEditNarrative(c.narrative);
    setEditType(c.type);
    setEditImportance(c.importance);
  };

  const saveEdit = (idx: number, original: MemoryCandidate) => {
    const updated: MemoryCandidate = {
      ...original,
      title: editTitle.trim() || original.title,
      narrative: editNarrative.trim() || original.narrative,
      type: editType,
      importance: editImportance,
    };
    if (onEditCandidate) {
      onEditCandidate(original, updated);
    }
    setEditingIndex(null);
  };

  const handleSave = async (idx: number, c: MemoryCandidate) => {
    setSavingIndex(idx);
    try {
      await onSaveCandidate(c);
      setSavedIndices((prev) => new Set(prev).add(idx));
    } finally {
      setSavingIndex(null);
    }
  };

  const handleIgnore = (idx: number, c: MemoryCandidate) => {
    onIgnoreCandidate(c);
    setIgnoredIndices((prev) => new Set(prev).add(idx));
  };

  return (
    <div
      data-testid="memory-candidate-review"
      className={`rounded-2xl border border-[#223056] bg-[#0E1730] p-5 space-y-4 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#223056] pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <Brain className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#EEF4FF] flex items-center gap-1.5">
              <span>Memory Candidate Review</span>
              <span className="text-sky-400 font-semibold">• {candidates.length} Proposed</span>
            </h3>
            <p className="text-[11px] text-[#888]">
              Gemini proposed these memory candidates. Explicit user action is required to save permanent memories.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md font-mono">
          <ShieldCheck className="h-3 w-3 shrink-0" />
          <span>User Control Enforced</span>
        </div>
      </div>

      {/* Candidates List */}
      <div className="space-y-3">
        {candidates.map((candidate, idx) => {
          const isSaved = savedIndices.has(idx);
          const isIgnored = ignoredIndices.has(idx);
          const isEditing = editingIndex === idx;
          const isSaving = savingIndex === idx;

          if (isIgnored) return null;

          const typeConfig = MEMORY_TYPE_CONFIG[candidate.type] || MEMORY_TYPE_CONFIG.idea;
          const Icon = typeConfig.icon;

          return (
            <div
              key={idx}
              data-testid={`memory-candidate-item-${idx}`}
              className={`rounded-xl border p-4 transition-all ${
                isSaved
                  ? 'border-emerald-800/40 bg-emerald-950/20'
                  : 'border-[#223056] bg-[#121E40] hover:border-[#334677]'
              }`}
            >
              {isEditing ? (
                /* Edit Form */
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-sky-400">Edit Memory Candidate</span>
                    <select
                      value={editType}
                      onChange={(e) => setEditType(e.target.value as MemoryType)}
                      className="rounded-lg border border-[#223056] bg-[#0E1730] px-2 py-1 text-xs text-[#EEF4FF] focus:outline-none"
                    >
                      {Object.entries(MEMORY_TYPE_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Memory title..."
                    className="w-full rounded-lg border border-[#223056] bg-[#0E1730] px-3 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                  />

                  <textarea
                    rows={2}
                    value={editNarrative}
                    onChange={(e) => setEditNarrative(e.target.value)}
                    placeholder="Detailed memory narrative..."
                    className="w-full rounded-lg border border-[#223056] bg-[#0E1730] p-2.5 text-xs text-[#EEF4FF] focus:outline-none resize-none"
                  />

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[#888] text-[11px]">Importance:</span>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setEditImportance(star)}
                          className={`p-0.5 text-xs ${
                            star <= editImportance ? 'text-amber-400' : 'text-[#444]'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="rounded-md border border-[#223056] px-2.5 py-1 text-xs text-[#888] hover:text-[#EEF4FF]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveEdit(idx, candidate)}
                        className="rounded-md bg-sky-500/20 border border-sky-500/40 px-2.5 py-1 text-xs font-medium text-sky-200 hover:bg-sky-500/30"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Candidate Display */
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${typeConfig.colorClass}`}
                      >
                        <Icon className="h-3 w-3" />
                        <span>{typeConfig.label}</span>
                      </span>

                      {/* Importance Rating Stars */}
                      <div className="flex items-center gap-0.5 text-amber-400 text-xs" title={`Importance: ${candidate.importance}/5`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < candidate.importance ? 'fill-amber-400 text-amber-400' : 'text-[#334677]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Provenance: Confidence % & Source */}
                    <div className="flex items-center gap-2 text-[11px] text-[#888]">
                      <span className="font-mono text-sky-400">
                        {Math.round(candidate.confidence * 100)}% Confidence
                      </span>
                      {sourceEntryId && (
                        <span className="text-[10px] text-[#666] font-mono">
                          Source: #{sourceEntryId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Narrative */}
                  <div>
                    <h4 className="text-xs font-semibold text-[#EEF4FF]">{candidate.title}</h4>
                    <p className="mt-0.5 text-xs text-[#D9E2F5]/90 leading-relaxed">
                      {candidate.narrative}
                    </p>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center justify-between border-t border-[#223056]/60 pt-2 text-xs">
                    <span className="text-[10px] text-[#666]">
                      {isSaved ? 'Saved to Permanent Memory' : 'Requires user review'}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {!isSaved ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(idx, candidate)}
                            className="flex items-center gap-1 rounded-md border border-[#223056] bg-[#0E1730] px-2 py-1 text-[11px] text-[#888] hover:text-[#EEF4FF] hover:bg-[#1A2957]"
                            title="Edit memory candidate before saving"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIgnore(idx, candidate)}
                            className="flex items-center gap-1 rounded-md border border-red-900/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/50"
                            title="Reject candidate memory"
                          >
                            <X className="h-3 w-3" />
                            <span>Ignore</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSave(idx, candidate)}
                            disabled={isSaving}
                            className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors disabled:opacity-40"
                            title="Save as permanent memory"
                          >
                            {isSaving ? (
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            <span>Save Memory</span>
                          </button>
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                          <Check className="h-3.5 w-3.5" />
                          <span>Saved to Memory</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
