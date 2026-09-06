import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Search,
  Filter,
  Check,
  X,
  Edit3,
  Trash2,
  Bookmark,
  ExternalLink,
  ShieldCheck,
  Star,
  Plus,
  RefreshCw,
  Tag as TagIcon,
  Clock,
  AlertCircle,
  Eye,
} from 'lucide-react';
import type { Memory, MemoryType, MemoryStatus } from '../../data/models';
import { MEMORY_TYPE_CONFIG } from './MemoryCandidateReview';
import {
  saveMemory,
  ignoreMemory,
  forgetMemory,
  deleteMemory,
  memoriesApi,
} from '../../data/services/memories';
import { toast } from '../../services/toast';

interface MemoryEngineViewProps {
  userId: string;
  memories: Memory[];
  onRefresh?: () => void;
  onViewSourceEntry?: (entryId: string) => void;
  className?: string;
}

type TabMode = 'candidates' | 'saved' | 'ignored_forgotten' | 'all';

export const MemoryEngineView: React.FC<MemoryEngineViewProps> = ({
  userId,
  memories,
  onRefresh,
  onViewSourceEntry,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<TabMode>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MemoryType | 'all'>('all');
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  // Form states for editing
  const [editTitle, setEditTitle] = useState('');
  const [editNarrative, setEditNarrative] = useState('');
  const [editType, setEditType] = useState<MemoryType>('idea');
  const [editImportance, setEditImportance] = useState(3);
  const [editTags, setEditTags] = useState('');

  // Filter logic
  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      // 1. Tab filter
      const status: MemoryStatus = m.status || (m.saved ? 'saved' : 'candidate');
      if (activeTab === 'candidates' && status !== 'candidate') return false;
      if (activeTab === 'saved' && status !== 'saved') return false;
      if (activeTab === 'ignored_forgotten' && status !== 'ignored' && status !== 'forgotten')
        return false;

      // 2. Type filter
      if (selectedType !== 'all' && m.type !== selectedType) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(q);
        const matchNarrative = m.narrative.toLowerCase().includes(q);
        const matchTags = m.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchTitle && !matchNarrative && !matchTags) return false;
      }

      return true;
    });
  }, [memories, activeTab, selectedType, searchQuery]);

  // Counts for tabs
  const counts = useMemo(() => {
    let candidates = 0;
    let saved = 0;
    let ignoredForgotten = 0;
    for (const m of memories) {
      const status: MemoryStatus = m.status || (m.saved ? 'saved' : 'candidate');
      if (status === 'candidate') candidates++;
      else if (status === 'saved') saved++;
      else if (status === 'ignored' || status === 'forgotten') ignoredForgotten++;
    }
    return { candidates, saved, ignoredForgotten, total: memories.length };
  }, [memories]);

  // Operations
  const handleSave = async (m: Memory) => {
    setIsProcessing(m.id);
    try {
      await saveMemory(m.id);
      toast.success(`Saved "${m.title}" to persistent memory.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to save memory:', err);
      toast.error('Failed to save memory.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleIgnore = async (m: Memory) => {
    setIsProcessing(m.id);
    try {
      await ignoreMemory(m.id);
      toast.success(`Ignored candidate "${m.title}".`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to ignore memory:', err);
      toast.error('Failed to ignore memory.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleForget = async (m: Memory) => {
    setIsProcessing(m.id);
    try {
      await forgetMemory(m.id);
      toast.success(`Un-saved memory "${m.title}".`);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to forget memory:', err);
      toast.error('Failed to forget memory.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDelete = async (memoryId: string) => {
    setIsProcessing(memoryId);
    try {
      await deleteMemory(memoryId);
      toast.success('Permanently deleted memory.');
      setDeletingId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to delete memory:', err);
      toast.error('Failed to delete memory.');
    } finally {
      setIsProcessing(null);
    }
  };

  const startEdit = (m: Memory) => {
    setEditingMemory(m);
    setEditTitle(m.title);
    setEditNarrative(m.narrative);
    setEditType(m.type);
    setEditImportance(m.importance);
    setEditTags(m.tags.join(', '));
  };

  const submitEdit = async () => {
    if (!editingMemory) return;
    setIsProcessing(editingMemory.id);
    try {
      const tagsArray = editTags
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean);

      await memoriesApi.update(editingMemory.id, {
        title: editTitle.trim() || editingMemory.title,
        narrative: editNarrative.trim() || editingMemory.narrative,
        type: editType,
        importance: editImportance,
        tags: tagsArray,
      });

      toast.success('Memory updated successfully.');
      setEditingMemory(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to update memory:', err);
      toast.error('Failed to update memory.');
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div
      data-testid="personal-memory-engine-view"
      className={`flex flex-col h-full bg-[#070B16] text-[#D9E2F5] p-4 sm:p-6 space-y-6 ${className}`}
    >
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#223056] pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#223056] bg-[#121E40] text-sky-400">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#EEF4FF]">
              Personal Memory Engine
            </h2>
            <p className="text-xs text-[#888]">
              AI extracts candidate memories from entries. You retain absolute control over permanent memories.
            </p>
          </div>
        </div>

        {/* Security badge & refresh */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Owner-Scoped Memory</span>
          </span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1.5 rounded-lg border border-[#223056] bg-[#121E40] px-2.5 py-1 text-xs font-medium text-[#9FB0D4] hover:bg-[#1A2957] hover:text-[#EEF4FF] transition-colors"
              title="Refresh memories"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Control Toolbar: Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs no-scrollbar">
          {[
            { id: 'saved', label: 'Saved Memories', count: counts.saved },
            { id: 'candidates', label: 'Candidates for Review', count: counts.candidates },
            { id: 'ignored_forgotten', label: 'Ignored / Forgotten', count: counts.ignoredForgotten },
            { id: 'all', label: 'All Memories', count: counts.total },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabMode)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-[#41599A] bg-[#26376B] text-[#EEF4FF]'
                  : 'border-[#223056] bg-[#121E40] text-[#888] hover:bg-[#1A2957] hover:text-[#D9E2F5]'
              }`}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-[#0E1730] px-1.5 py-0.2 text-[10px] font-mono text-sky-300">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-2">
          {/* Memory Type Filter */}
          <div className="relative">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as MemoryType | 'all')}
              className="rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 text-xs text-[#EEF4FF] focus:outline-none focus:border-sky-500"
            >
              <option value="all">All Memory Types</option>
              {Object.entries(MEMORY_TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#666]" />
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#223056] bg-[#121E40] pl-8 pr-3 py-1.5 text-xs text-[#EEF4FF] placeholder:text-[#666] focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Memory List / Cards Grid */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
        {filteredMemories.length === 0 ? (
          <div className="rounded-2xl border border-[#223056] bg-[#0E1730] p-12 text-center space-y-3 max-w-md mx-auto my-12">
            <Brain className="mx-auto h-8 w-8 text-[#555]" />
            <h3 className="text-sm font-semibold text-[#EEF4FF]">No Memories Found</h3>
            <p className="text-xs text-[#888]">
              {searchQuery || selectedType !== 'all'
                ? 'No memories match your active search filter.'
                : activeTab === 'candidates'
                ? 'No proposed memory candidates awaiting review.'
                : activeTab === 'saved'
                ? 'No saved memories yet. Write journal entries to extract candidates!'
                : 'No ignored or forgotten memories.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredMemories.map((memory) => {
              const typeConfig = MEMORY_TYPE_CONFIG[memory.type] || MEMORY_TYPE_CONFIG.idea;
              const Icon = typeConfig.icon;
              const status: MemoryStatus = memory.status || (memory.saved ? 'saved' : 'candidate');
              const primarySourceId = memory.sourceEntryIds?.[0];

              return (
                <motion.div
                  key={memory.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex flex-col justify-between rounded-2xl border p-5 space-y-4 transition-all ${
                    status === 'saved'
                      ? 'border-[#223056] bg-[#0E1730] hover:border-[#3B518E]'
                      : status === 'candidate'
                      ? 'border-sky-900/50 bg-[#0E1832]'
                      : 'border-[#1C2542] bg-[#0A0F21] opacity-75'
                  }`}
                >
                  {/* Top Metadata Header */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${typeConfig.colorClass}`}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{typeConfig.label}</span>
                        </span>

                        {/* Status badge */}
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-mono capitalize ${
                            status === 'saved'
                              ? 'bg-emerald-950/40 border border-emerald-800/40 text-emerald-400'
                              : status === 'candidate'
                              ? 'bg-sky-950/40 border border-sky-800/40 text-sky-400'
                              : 'bg-[#17254F] border border-[#223056] text-[#888]'
                          }`}
                        >
                          {status}
                        </span>
                      </div>

                      {/* Importance & Confidence */}
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-0.5 text-amber-400" title={`Importance: ${memory.importance}/5`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < memory.importance ? 'fill-amber-400 text-amber-400' : 'text-[#334677]'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="font-mono text-[11px] text-sky-400">
                          {Math.round(memory.confidence * 100)}% Confidence
                        </span>
                      </div>
                    </div>

                    {/* Title & Narrative */}
                    <div>
                      <h3 className="font-serif text-base font-bold text-[#EEF4FF]">{memory.title}</h3>
                      <p className="mt-1 text-xs text-[#D9E2F5]/90 leading-relaxed whitespace-pre-wrap">
                        {memory.narrative}
                      </p>
                    </div>

                    {/* Tags */}
                    {memory.tags && memory.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <TagIcon className="h-3 w-3 text-[#666]" />
                        {memory.tags.map((tag, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-[#121E40] border border-[#223056] px-2 py-0.5 text-[10px] font-medium text-sky-300"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom Provenance & Actions Footer */}
                  <div className="border-t border-[#223056] pt-3 flex items-center justify-between gap-2 text-xs">
                    {/* Provenance: Source Entry link */}
                    <div className="flex items-center gap-2 text-[11px] text-[#888]">
                      {primarySourceId && onViewSourceEntry ? (
                        <button
                          onClick={() => onViewSourceEntry(primarySourceId)}
                          className="flex items-center gap-1 font-mono text-sky-400 hover:underline"
                          title="View source journal entry"
                        >
                          <ExternalLink className="h-3 w-3" />
                          <span>Source Entry #{primarySourceId.slice(0, 8)}</span>
                        </button>
                      ) : (
                        <span className="font-mono text-[#666]">
                          Source: {primarySourceId ? `#${primarySourceId.slice(0, 8)}` : 'Manual'}
                        </span>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-1.5">
                      {status === 'candidate' && (
                        <>
                          <button
                            onClick={() => handleIgnore(memory)}
                            disabled={isProcessing === memory.id}
                            className="flex items-center gap-1 rounded-md border border-red-900/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/50"
                          >
                            <X className="h-3 w-3" />
                            <span>Ignore</span>
                          </button>
                          <button
                            onClick={() => handleSave(memory)}
                            disabled={isProcessing === memory.id}
                            className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30"
                          >
                            <Check className="h-3 w-3" />
                            <span>Save Memory</span>
                          </button>
                        </>
                      )}

                      {status === 'saved' && (
                        <>
                          <button
                            onClick={() => startEdit(memory)}
                            className="flex items-center gap-1 rounded-md border border-[#223056] bg-[#121E40] px-2 py-1 text-[11px] text-[#888] hover:text-[#EEF4FF]"
                            title="Edit memory"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleForget(memory)}
                            disabled={isProcessing === memory.id}
                            className="flex items-center gap-1 rounded-md border border-[#223056] bg-[#121E40] px-2 py-1 text-[11px] text-[#888] hover:text-amber-400 hover:border-amber-800/40"
                            title="Un-save memory"
                          >
                            <Bookmark className="h-3 w-3" />
                            <span>Forget</span>
                          </button>
                          <button
                            onClick={() => setDeletingId(memory.id)}
                            className="flex items-center gap-1 rounded-md border border-red-900/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-950/60"
                            title="Permanently delete memory"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}

                      {(status === 'ignored' || status === 'forgotten') && (
                        <>
                          <button
                            onClick={() => handleSave(memory)}
                            disabled={isProcessing === memory.id}
                            className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/30"
                          >
                            <Check className="h-3 w-3" />
                            <span>Restore to Saved</span>
                          </button>
                          <button
                            onClick={() => setDeletingId(memory.id)}
                            className="flex items-center gap-1 rounded-md border border-red-900/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-400 hover:bg-red-950/60"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Memory Modal */}
      {editingMemory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#223056] bg-[#0E1730] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#223056] pb-3">
              <h3 className="font-serif text-lg font-bold text-[#EEF4FF]">Edit Memory</h3>
              <button
                onClick={() => setEditingMemory(null)}
                className="text-[#888] hover:text-[#EEF4FF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1">Memory Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as MemoryType)}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                >
                  {Object.entries(MEMORY_TYPE_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#888] mb-1">Narrative Content</label>
                <textarea
                  rows={4}
                  value={editNarrative}
                  onChange={(e) => setEditNarrative(e.target.value)}
                  className="w-full rounded-lg border border-[#223056] bg-[#121E40] p-3 text-xs text-[#EEF4FF] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-[#888] mb-1">Importance (1-5)</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setEditImportance(star)}
                        className={`text-sm ${star <= editImportance ? 'text-amber-400' : 'text-[#444]'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 ml-4">
                  <label className="block text-xs font-semibold text-[#888] mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="Project, Goal, Focus..."
                    className="w-full rounded-lg border border-[#223056] bg-[#121E40] px-3 py-1.5 text-xs text-[#EEF4FF] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#223056] pt-3">
              <button
                onClick={() => setEditingMemory(null)}
                className="rounded-lg border border-[#223056] px-4 py-1.5 text-xs font-medium text-[#888] hover:text-[#EEF4FF]"
              >
                Cancel
              </button>
              <button
                onClick={submitEdit}
                className="rounded-lg bg-sky-500/20 border border-sky-500/40 px-4 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-900/60 bg-[#0E1730] p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-200 text-sm">Delete Memory Permanently?</h3>
                <p className="mt-1 text-xs text-red-300/80">
                  This action cannot be undone. The memory document will be permanently deleted from Firestore.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#223056] pt-3">
              <button
                onClick={() => setDeletingId(null)}
                className="rounded-lg border border-[#223056] px-3.5 py-1.5 text-xs text-[#888] hover:text-[#EEF4FF]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="rounded-lg bg-red-900/80 border border-red-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
