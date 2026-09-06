import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Calendar,
  RefreshCw,
  FileText,
  Target,
  Award,
  AlertTriangle,
  Lightbulb,
  Repeat,
  Clock,
  ExternalLink,
  ShieldAlert,
  Brain,
  Compass,
  CheckCircle,
} from 'lucide-react';
import type { JournalEntry, Memory, Goal, InsightKind } from '../../data/models';
import {
  generateReflectionReport,
  type StructuredReflectionReport,
  type EvidenceVsInterpretation,
} from '../../services/reflectionReports';

export interface ReflectionReportsViewProps {
  entries: JournalEntry[];
  memories?: Memory[];
  goals?: Goal[];
  currentUserId: string;
  onSelectEntry?: (entryId: string) => void;
}

export const ReflectionReportsView: React.FC<ReflectionReportsViewProps> = ({
  entries,
  memories = [],
  goals = [],
  currentUserId,
  onSelectEntry,
}) => {
  const [selectedKind, setSelectedKind] = useState<InsightKind>('weekly');
  const [offsetPeriods, setOffsetPeriods] = useState<number>(0);
  const [forceRegenCount, setForceRegenCount] = useState<number>(0);

  // Compute period boundaries based on selectedKind and offsetPeriods
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (selectedKind === 'daily') {
      start.setDate(now.getDate() + offsetPeriods);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() + offsetPeriods);
      end.setHours(23, 59, 59, 999);
    } else if (selectedKind === 'weekly') {
      const day = now.getDay();
      const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1) + offsetPeriods * 7;
      start = new Date(now.setDate(diffToMon));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (selectedKind === 'monthly') {
      start = new Date(now.getFullYear(), now.getMonth() + offsetPeriods, 1);
      end = new Date(now.getFullYear(), now.getMonth() + offsetPeriods + 1, 0, 23, 59, 59, 999);
    } else if (selectedKind === 'yearly') {
      start = new Date(now.getFullYear() + offsetPeriods, 0, 1);
      end = new Date(now.getFullYear() + offsetPeriods, 11, 31, 23, 59, 59, 999);
    }

    return { periodStart: start, periodEnd: end };
  }, [selectedKind, offsetPeriods]);

  // Generate or retrieve cached report
  const report: StructuredReflectionReport = useMemo(() => {
    return generateReflectionReport({
      kind: selectedKind,
      periodStart,
      periodEnd,
      entries,
      memories,
      goals,
      currentUserId,
      forceRegenerate: forceRegenCount > 0,
    });
  }, [selectedKind, periodStart, periodEnd, entries, memories, goals, currentUserId, forceRegenCount]);

  const handleRegenerate = () => {
    setForceRegenCount((prev) => prev + 1);
  };

  const renderSectionCard = (
    title: string,
    icon: React.ReactNode,
    items: EvidenceVsInterpretation[],
    accentColor: string
  ) => (
    <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-md">
      <div className="flex items-center gap-2 text-slate-200">
        <div className={`p-2 rounded-xl ${accentColor}`}>{icon}</div>
        <h4 className="text-sm font-semibold tracking-wide">{title}</h4>
      </div>

      {items.length === 0 ? (
        <div className="text-xs text-slate-500 italic p-2">No items recorded for this section.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
              {/* Evidence Badge */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Observed Evidence
                  </span>
                  {item.sourceEntryId && item.sourceEntryTitle && (
                    <button
                      onClick={() => onSelectEntry && onSelectEntry(item.sourceEntryId!)}
                      className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1"
                      title="View Source Journal Entry"
                    >
                      <span>Source: {item.sourceEntryTitle}</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="text-slate-300 italic font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                  {item.observedEvidence}
                </div>
              </div>

              {/* Interpretation Badge */}
              <div className="space-y-1 pt-1">
                <span className="text-[10px] uppercase font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  AI Interpretation & Reflection
                </span>
                <div className="text-slate-200 font-medium">{item.aiInterpretation}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Kind Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-3xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-950 border border-purple-500/20 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">AI Reflection Reports</h2>
          </div>
          <p className="text-xs text-slate-400">
            Grounded multi-period reflection analysis. Evidence-backed and transparent.
          </p>
        </div>

        {/* Kind Buttons */}
        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800">
          {(['daily', 'weekly', 'monthly', 'yearly'] as InsightKind[]).map((k) => (
            <button
              key={k}
              onClick={() => {
                setSelectedKind(k);
                setOffsetPeriods(0);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                selectedKind === k
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {/* Period Navigation & Cache Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
          <Calendar className="w-4 h-4 text-purple-400" />
          <span>{report.title}</span>
          {report.isCached && (
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
              Cached (Cost Optimized)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setOffsetPeriods((prev) => prev - 1)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white"
          >
            ← Previous {selectedKind}
          </button>
          {offsetPeriods !== 0 && (
            <button
              onClick={() => setOffsetPeriods(0)}
              className="px-3 py-1.5 rounded-xl bg-purple-950/60 border border-purple-500/30 text-xs text-purple-300 hover:text-white"
            >
              Current {selectedKind}
            </button>
          )}
          <button
            onClick={() => setOffsetPeriods((prev) => prev + 1)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 hover:text-white"
          >
            Next {selectedKind} →
          </button>

          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Regenerate Report</span>
          </button>
        </div>
      </div>

      {/* Verified Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Entries Analyzed</span>
          </div>
          <div className="text-xl font-bold text-slate-100">{report.stats.totalEntries}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span>Words Written</span>
          </div>
          <div className="text-xl font-bold text-slate-100">{report.stats.totalWords}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Target className="w-4 h-4 text-amber-400" />
            <span>Active Goals</span>
          </div>
          <div className="text-xl font-bold text-slate-100">{report.stats.activeGoalsCount}</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Brain className="w-4 h-4 text-sky-400" />
            <span>Memories Formed</span>
          </div>
          <div className="text-xl font-bold text-slate-100">{report.stats.memoriesFormedCount}</div>
        </div>
      </div>

      {/* Report Grid Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderSectionCard('Highlights', <Award className="w-4 h-4 text-emerald-400" />, report.highlights, 'bg-emerald-500/10')}
        {renderSectionCard('Difficult Moments', <AlertTriangle className="w-4 h-4 text-rose-400" />, report.difficultMoments, 'bg-rose-500/10')}
        {renderSectionCard('Lessons Learned', <Lightbulb className="w-4 h-4 text-amber-400" />, report.lessons, 'bg-amber-500/10')}
        {renderSectionCard('Recurring Themes', <Repeat className="w-4 h-4 text-purple-400" />, report.recurringThemes, 'bg-purple-500/10')}
        {renderSectionCard('Goal Progress', <Target className="w-4 h-4 text-blue-400" />, report.goalProgress, 'bg-blue-500/10')}
        {renderSectionCard('Unfinished Intentions', <Clock className="w-4 h-4 text-orange-400" />, report.unfinishedIntentions, 'bg-orange-500/10')}
        {renderSectionCard('Meaningful Memories', <Brain className="w-4 h-4 text-indigo-400" />, report.meaningfulMemories, 'bg-indigo-500/10')}
        {renderSectionCard('Suggested Focus', <Compass className="w-4 h-4 text-teal-400" />, report.suggestedFocus, 'bg-teal-500/10')}
      </div>

      {/* Grounding Disclaimer */}
      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
        <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />
        <span>{report.disclaimer}</span>
      </div>
    </div>
  );
};
