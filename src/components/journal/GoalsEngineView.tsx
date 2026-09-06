import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Target,
  Trophy,
  Flag,
  Calendar,
  Sparkles,
  PlusCircle,
  CheckCircle2,
  Circle,
  BookOpen,
  Search,
  Filter,
  X,
  Edit3,
  Trash2,
  MessageSquareHeart,
  Sliders,
  ExternalLink,
  ShieldCheck,
  Brain,
  Layers,
  ChevronRight,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import type { Goal, GoalStatus, Milestone, JournalEntry } from '../../data/models';
import {
  filterUserGoals,
  calculateGoalsStats,
  toggleGoalMilestone,
  addGoalMilestone,
  deleteGoalMilestone,
  linkEntryToGoal,
  unlinkEntryFromGoal,
  completeGoal,
  analyzeGoalEvidence,
  type GoalEvidenceProposal,
} from '../../services/goalsEngine';
import { formatEntryDate, formatShortDate } from '../../journal/format';

export interface GoalsEngineViewProps {
  goals: Goal[];
  entries: JournalEntry[];
  currentUserId: string;
  onCreateGoal?: (newGoalInput: Partial<Goal>) => void;
  onUpdateGoal?: (goalId: string, updates: Partial<Goal>) => void;
  onDeleteGoal?: (goalId: string) => void;
  onOpenEntry?: (entryId: string) => void;
  onCreateGoalReflection?: (goal: Goal) => void;
  className?: string;
}

export const GoalsEngineView: React.FC<GoalsEngineViewProps> = ({
  goals,
  entries,
  currentUserId,
  onCreateGoal,
  onUpdateGoal,
  onDeleteGoal,
  onOpenEntry,
  onCreateGoalReflection,
  className = '',
}) => {
  // Filter user goals by ownership boundary
  const userGoals = useMemo(() => filterUserGoals(goals, currentUserId), [goals, currentUserId]);
  const userEntries = useMemo(
    () => entries.filter((e) => e.uid === currentUserId && !e.archived),
    [entries, currentUserId]
  );

  // Stats calculation
  const stats = useMemo(() => calculateGoalsStats(userGoals), [userGoals]);

  // Filters & State
  const [activeTab, setActiveTab] = useState<GoalStatus | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [aiProposal, setAiProposal] = useState<GoalEvidenceProposal | null>(null);

  // New Milestone input in edit modal
  const [newMilestoneText, setNewMilestoneText] = useState<string>('');

  // Form state for goal creation
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTargetDate, setNewTargetDate] = useState('');
  const [newTags, setNewTags] = useState('');

  // Filtered goals stream
  const filteredGoals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return userGoals.filter((g) => {
      if (activeTab !== 'all' && g.status !== activeTab) return false;
      if (query) {
        const inTitle = g.title.toLowerCase().includes(query);
        const inDesc = g.description.toLowerCase().includes(query);
        const inTags = (g.tags || []).some((t) => t.toLowerCase().includes(query));
        if (!inTitle && !inDesc && !inTags) return false;
      }
      return true;
    });
  }, [userGoals, activeTab, searchQuery]);

  // Goal Creation Handler
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const tagsArray = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onCreateGoal?.({
      title: newTitle.trim(),
      description: newDescription.trim(),
      status: 'active',
      progress: 0,
      targetDate: newTargetDate ? ({ toDate: () => new Date(newTargetDate), seconds: Math.floor(new Date(newTargetDate).getTime() / 1000), nanoseconds: 0 } as any) : null,
      milestones: [],
      relatedEntryIds: [],
      tags: tagsArray,
    });

    setNewTitle('');
    setNewDescription('');
    setNewTargetDate('');
    setNewTags('');
    setCreateModalOpen(false);
  };

  // Toggle milestone handler
  const handleToggleMilestone = (goal: Goal, milestoneId: string) => {
    const updated = toggleGoalMilestone(goal, milestoneId);
    onUpdateGoal?.(goal.id, {
      milestones: updated.milestones,
      progress: updated.progress,
      status: updated.status,
    });

    if (editingGoal && editingGoal.id === goal.id) {
      setEditingGoal(updated);
    }
  };

  // Add milestone handler
  const handleAddMilestone = (goal: Goal) => {
    if (!newMilestoneText.trim()) return;
    const updated = addGoalMilestone(goal, newMilestoneText);
    onUpdateGoal?.(goal.id, {
      milestones: updated.milestones,
      progress: updated.progress,
    });

    setNewMilestoneText('');
    if (editingGoal && editingGoal.id === goal.id) {
      setEditingGoal(updated);
    }
  };

  // Delete milestone handler
  const handleDeleteMilestone = (goal: Goal, milestoneId: string) => {
    const updated = deleteGoalMilestone(goal, milestoneId);
    onUpdateGoal?.(goal.id, {
      milestones: updated.milestones,
      progress: updated.progress,
    });

    if (editingGoal && editingGoal.id === goal.id) {
      setEditingGoal(updated);
    }
  };

  // Complete goal toggle handler
  const handleToggleCompleteGoal = (goal: Goal) => {
    if (goal.status === 'completed') {
      onUpdateGoal?.(goal.id, { status: 'active', progress: Math.min(goal.progress, 90) });
    } else {
      const completed = completeGoal(goal);
      onUpdateGoal?.(goal.id, {
        status: 'completed',
        progress: 100,
        milestones: completed.milestones,
      });
    }
  };

  // Gemini Evidence Analysis Trigger
  const handleAnalyzeEvidence = (goal: Goal) => {
    const proposal = analyzeGoalEvidence(goal, userEntries, currentUserId);
    setAiProposal(proposal);
  };

  // Apply AI Evidence Proposal
  const handleApplyAiProposal = (proposal: GoalEvidenceProposal) => {
    const targetGoal = userGoals.find((g) => g.id === proposal.goalId);
    if (!targetGoal) return;

    // Unique merged entries
    const mergedEntries = Array.from(
      new Set([...targetGoal.relatedEntryIds, ...proposal.suggestedEntryIds])
    );

    // Update milestones if any were suggested as complete
    let updatedMilestones = [...targetGoal.milestones];
    if (proposal.completedMilestoneIds.length > 0) {
      updatedMilestones = updatedMilestones.map((m) =>
        proposal.completedMilestoneIds.includes(m.id) ? { ...m, done: true } : m
      );
    }

    onUpdateGoal?.(targetGoal.id, {
      relatedEntryIds: mergedEntries,
      milestones: updatedMilestones,
      progress: proposal.proposedProgress,
      status: proposal.proposedProgress >= 100 ? 'completed' : targetGoal.status,
    });

    setAiProposal(null);
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Hero Header & Statistics */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950/60 via-slate-900/90 to-teal-950/50 p-6 md:p-8 border border-emerald-500/20 shadow-2xl backdrop-blur-xl">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold tracking-wide">
              <Target className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>GOALS & INTENTIONS ENGINE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-100 via-teal-100 to-sky-200 bg-clip-text text-transparent">
              Personal Goals & Milestones
            </h1>
            <p className="text-sm text-slate-300 max-w-xl leading-relaxed">
              Set meaningful intentions, track evidence-based progress from your journal, and celebrate every step forward.
            </p>
          </div>

          {/* Action & Stats summary */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex items-center gap-4 bg-slate-900/70 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
              <div className="text-center px-2">
                <div className="text-xl font-bold text-emerald-300">{stats.active}</div>
                <div className="text-[11px] text-slate-400">Active</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center px-2">
                <div className="text-xl font-bold text-amber-300">{stats.completed}</div>
                <div className="text-[11px] text-slate-400">Completed</div>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center px-2">
                <div className="text-xl font-bold text-purple-300">{stats.overallCompletionRate}%</div>
                <div className="text-[11px] text-slate-400">Milestones Done</div>
              </div>
            </div>

            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create New Goal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(['active', 'completed', 'all', 'paused', 'archived'] as const).map((tabKey) => (
            <button
              key={tabKey}
              onClick={() => setActiveTab(tabKey)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition ${
                activeTab === tabKey
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                  : 'bg-slate-900/80 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              {tabKey} ({userGoals.filter((g) => (tabKey === 'all' ? true : g.status === tabKey)).length})
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search goals or tags..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Goal Cards Grid */}
      {filteredGoals.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
            <Target className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-slate-200">No Goals Found</h3>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            {searchQuery
              ? 'No goals matched your search query.'
              : `You currently have no ${activeTab === 'all' ? '' : activeTab} goals.`}
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Your First Goal</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredGoals.map((goal) => {
            const isCompleted = goal.status === 'completed' || goal.progress >= 100;
            const milestonesDone = (goal.milestones || []).filter((m) => m.done).length;
            const totalMilestones = (goal.milestones || []).length;
            const evidenceCount = (goal.relatedEntryIds || []).length;

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative rounded-2xl bg-slate-900/80 border p-6 backdrop-blur-md transition-all duration-300 shadow-xl flex flex-col justify-between space-y-5 ${
                  isCompleted
                    ? 'border-amber-500/30 bg-gradient-to-br from-slate-900/90 to-amber-950/20'
                    : 'border-slate-800 hover:border-emerald-500/40'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Status & Date */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                          isCompleted
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            : goal.status === 'paused'
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {isCompleted ? <Trophy className="w-3 h-3 text-amber-400" /> : <Target className="w-3 h-3 text-emerald-400" />}
                        <span>{goal.status}</span>
                      </span>

                      {evidenceCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
                          <BookOpen className="w-3 h-3 text-indigo-400" /> {evidenceCount} Evidences
                        </span>
                      )}
                    </div>

                    {goal.targetDate && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        Target: {formatShortDate(goal.targetDate)}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-100 hover:text-emerald-200 cursor-pointer transition" onClick={() => setEditingGoal(goal)}>
                      {goal.title}
                    </h3>
                    {goal.description && (
                      <p className="text-sm text-slate-300/90 leading-relaxed line-clamp-2">
                        {goal.description}
                      </p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Progress</span>
                      <span className="font-bold text-slate-200">{goal.progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        }`}
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Milestones Preview Checklist */}
                  {totalMilestones > 0 && (
                    <div className="space-y-2 pt-1 border-t border-slate-800/60">
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                        <span>Milestones ({milestonesDone}/{totalMilestones})</span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {goal.milestones.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => handleToggleMilestone(goal, m.id)}
                            className="flex items-center gap-2 text-xs text-slate-300 hover:text-slate-100 cursor-pointer select-none py-0.5"
                          >
                            {m.done ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                            )}
                            <span className={m.done ? 'line-through text-slate-500' : ''}>
                              {m.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {(goal.tags || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {goal.tags.map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-400 border border-slate-700/50">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bottom Card Action Bar */}
                <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleCompleteGoal(goal)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        isCompleted
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isCompleted ? 'Reopen Goal' : 'Complete'}
                    </button>

                    {onCreateGoalReflection && (
                      <button
                        onClick={() => onCreateGoalReflection(goal)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/40 text-purple-200 text-xs font-medium transition"
                        title="Reflect on this goal in your journal"
                      >
                        <MessageSquareHeart className="w-3.5 h-3.5 text-purple-400" />
                        <span>Reflect</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAnalyzeEvidence(goal)}
                      className="p-2 rounded-lg bg-indigo-900/40 hover:bg-indigo-800/60 border border-indigo-700/40 text-indigo-300 transition"
                      title="Analyze Journal Evidence with Gemini AI"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                    </button>

                    <button
                      onClick={() => setEditingGoal(goal)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Edit Goal & Evidence"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    {onDeleteGoal && (
                      <button
                        onClick={() => onDeleteGoal(goal.id)}
                        className="p-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 text-rose-300 transition"
                        title="Delete Goal"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Goal Detail & Edit Modal */}
      <AnimatePresence>
        {editingGoal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-6 shadow-2xl"
            >
              <button
                onClick={() => setEditingGoal(null)}
                className="absolute right-4 top-4 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  <span>Edit Goal & Milestones</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Update goal progress, milestones, and linked journal evidence.
                </p>
              </div>

              {/* Title & Description Edit */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Goal Title</label>
                  <input
                    type="text"
                    value={editingGoal.title}
                    onChange={(e) => {
                      const updated = { ...editingGoal, title: e.target.value };
                      setEditingGoal(updated);
                      onUpdateGoal?.(editingGoal.id, { title: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={editingGoal.description}
                    onChange={(e) => {
                      const updated = { ...editingGoal, description: e.target.value };
                      setEditingGoal(updated);
                      onUpdateGoal?.(editingGoal.id, { description: e.target.value });
                    }}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Progress Slider */}
                <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between text-xs font-semibold text-slate-300">
                    <span>Manual Progress Adjustment</span>
                    <span className="text-emerald-400">{editingGoal.progress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editingGoal.progress}
                    onChange={(e) => {
                      const p = parseInt(e.target.value, 10);
                      const isComplete = p >= 100;
                      const updated = { ...editingGoal, progress: p, status: isComplete ? ('completed' as GoalStatus) : editingGoal.status };
                      setEditingGoal(updated);
                      onUpdateGoal?.(editingGoal.id, { progress: p, status: updated.status });
                    }}
                    className="w-full accent-emerald-500"
                  />
                </div>

                {/* Milestone Manager */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Milestones Breakdown</span>
                    <span className="text-slate-500 font-normal">
                      {(editingGoal.milestones || []).filter((m) => m.done).length}/{(editingGoal.milestones || []).length} Done
                    </span>
                  </h4>

                  <div className="space-y-2">
                    {(editingGoal.milestones || []).map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <div
                          onClick={() => handleToggleMilestone(editingGoal, m.id)}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          {m.done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                          <span className={`text-xs text-slate-200 ${m.done ? 'line-through text-slate-500' : ''}`}>
                            {m.title}
                          </span>
                        </div>

                        <button
                          onClick={() => handleDeleteMilestone(editingGoal, m.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Add Milestone Input */}
                    <div className="flex gap-2 pt-1">
                      <input
                        type="text"
                        value={newMilestoneText}
                        onChange={(e) => setNewMilestoneText(e.target.value)}
                        placeholder="Add a new milestone step..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={() => handleAddMilestone(editingGoal)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Linked Journal Evidence Section */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
                    <span>Journal Evidence ({(editingGoal.relatedEntryIds || []).length})</span>
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                  </h4>

                  <div className="space-y-2">
                    {(editingGoal.relatedEntryIds || []).map((entryId) => {
                      const entry = userEntries.find((e) => e.id === entryId);
                      return (
                        <div key={entryId} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                          <div>
                            <span className="font-semibold text-slate-200 block">
                              {entry?.title || `Entry #${entryId.slice(0, 6)}`}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {entry ? formatEntryDate(entry.createdAt) : 'Journal Evidence'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {onOpenEntry && (
                              <button
                                onClick={() => {
                                  setEditingGoal(null);
                                  onOpenEntry(entryId);
                                }}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] flex items-center gap-1"
                              >
                                <span>View</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </button>
                            )}

                            <button
                              onClick={() => {
                                const updated = unlinkEntryFromGoal(editingGoal, entryId);
                                setEditingGoal(updated);
                                onUpdateGoal?.(editingGoal.id, { relatedEntryIds: updated.relatedEntryIds });
                              }}
                              className="p-1 text-slate-500 hover:text-rose-400"
                              title="Unlink entry"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Dropdown to link unlinked entries */}
                    <div className="pt-2">
                      <select
                        onChange={(e) => {
                          const val = e.target.value;
                          if (!val) return;
                          const targetEntry = userEntries.find((entry) => entry.id === val);
                          if (targetEntry) {
                            const updated = linkEntryToGoal(editingGoal, targetEntry, currentUserId);
                            setEditingGoal(updated);
                            onUpdateGoal?.(editingGoal.id, { relatedEntryIds: updated.relatedEntryIds });
                          }
                          e.target.value = '';
                        }}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">+ Associate Unlinked Journal Entry...</option>
                        {userEntries
                          .filter((e) => !(editingGoal.relatedEntryIds || []).includes(e.id))
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.title || 'Untitled'} ({formatShortDate(e.createdAt)})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-800">
                <button
                  onClick={() => setEditingGoal(null)}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition"
                >
                  Done Editing
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gemini Evidence Analysis Proposal Modal */}
      <AnimatePresence>
        {aiProposal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-indigo-500/40 p-6 md:p-8 space-y-5 shadow-2xl"
            >
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>GEMINI GOAL EVIDENCE ANALYSIS</span>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-100">
                  Evidence-Grounded Progress Proposal
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  {aiProposal.reasoning}
                </p>
              </div>

              {aiProposal.groundedEvidence.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Grounded Journal Evidence
                  </h4>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {aiProposal.groundedEvidence.map((ev, i) => (
                      <div key={i} className="p-2 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-200">
                        • {ev}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Proposed Progress: <strong className="text-white">{aiProposal.proposedProgress}%</strong>. User confirmation required.
                </span>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  onClick={() => setAiProposal(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
                >
                  Dismiss
                </button>

                <button
                  onClick={() => handleApplyAiProposal(aiProposal)}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition"
                >
                  Apply Evidence Updates
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Goal Creation Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 md:p-8 space-y-5 shadow-2xl"
            >
              <button
                onClick={() => setCreateModalOpen(false)}
                className="absolute right-4 top-4 p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span>Create New Goal</span>
              </h2>

              <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Goal Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Run a 10K Marathon, Launch Side Project"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe what success looks like..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Target Date</label>
                  <input
                    type="date"
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="e.g. fitness, career, habit"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30"
                  >
                    Save Goal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
