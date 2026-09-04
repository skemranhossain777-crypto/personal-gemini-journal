import React, { useState, useRef, useEffect, useMemo } from 'react';
import Markdown from 'react-markdown';
import {
  Sparkles,
  Send,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Brain,
  MessageSquare,
  Lightbulb,
  FileText,
  Clock,
  Tag,
  Copy,
  Check,
  MapPin,
  Download,
  Save,
} from 'lucide-react';
import type { JournalInteraction, JournalMessage, ReflectionMode, JournalLocation } from '../types';
import { saveUserInteraction } from '../services/firestore';
import { reflect as callReflect } from '../services/ai';
import { toast } from '../services/toast';
import { LocationPicker } from './LocationPicker';

interface JournalEditorProps {
  userId: string;
  interaction: JournalInteraction | null;
  onInteractionUpdated: (updated: JournalInteraction) => void;
  onNewEntry: () => void;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  userId,
  interaction,
  onInteractionUpdated,
  onNewEntry,
}) => {
  // Local active state
  const [title, setTitle] = useState(interaction?.title || '');
  const [mode, setMode] = useState<ReflectionMode>(interaction?.mode || 'reflect');
  const [inputBuffer, setInputBuffer] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [location, setLocation] = useState<JournalLocation | null>(interaction?.location || null);
  const [isTitleSaving, setIsTitleSaving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentMessages: JournalMessage[] = interaction?.messages || [];

  // Model actually used by the server fallback ladder (accurate, not the
  // hardcoded promo name).
  const activeModel = interaction?.modelUsed || 'gemini-3.6-flash';

  // Debounced autosave for in-place title edits on existing entries. Skips when
  // unchanged so opening an entry never needs a write.
  useEffect(() => {
    if (!interaction) return;
    if (title === interaction.title) return;

    if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    setIsTitleSaving(true);
    titleSaveTimerRef.current = setTimeout(async () => {
      try {
        await saveUserInteraction(userId, {
          ...interaction,
          title: title.trim() || interaction.title,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Title autosave failed:', err);
        toast.error('Could not save the updated title.');
      } finally {
        setIsTitleSaving(false);
      }
    }, 900);

    return () => {
      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
    };
  }, [title, interaction, userId]);

  // Synchronize when selected interaction changes
  useEffect(() => {
    if (interaction) {
      setTitle(interaction.title || '');
      setMode(interaction.mode || 'reflect');
      setLocation(interaction.location || null);
      setSaveStatus('saved');
      setErrorMessage(null);
    } else {
      setTitle('');
      setMode('reflect');
      setLocation(null);
      setInputBuffer('');
      setSaveStatus('idle');
      setErrorMessage(null);
    }
    setIsTitleSaving(false);
    if (titleSaveTimerRef.current) {
      clearTimeout(titleSaveTimerRef.current);
      titleSaveTimerRef.current = null;
    }
  }, [interaction?.id]);

  // Scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [interaction?.id, interaction?.messages?.length, isGenerating]);

  // Quick prompt suggestions
  const promptSuggestions = [
    { label: 'Unpack a challenge', text: 'Today I faced a challenging situation that tested my patience. Here is what happened: ' },
    { label: 'Brainstorm solutions', text: 'I want to brainstorm 3 creative solutions and next steps for: ' },
    { label: 'Daily reflection', text: 'Three key highlights from my day, what I learned, and what I want to improve: ' },
    { label: 'Summarize thoughts', text: 'Here are my scattered thoughts about my current goals, help me summarize them into clear takeaways: ' },
  ];

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportMarkdown = () => {
    const source = interaction;
    if (!source) return;

    const lines: string[] = [];
    lines.push(`# ${source.title || 'Untitled Reflection'}`);
    lines.push('');
    lines.push(`- **Mode:** ${source.mode}`);
    lines.push(`- **Created:** ${new Date(source.createdAt).toLocaleString()}`);
    lines.push(`- **Updated:** ${new Date(source.updatedAt).toLocaleString()}`);
    if (source.modelUsed) lines.push(`- **Model:** ${source.modelUsed}`);
    if (source.location) {
      lines.push(`- **Location:** ${source.location.placeName}${source.location.address ? ` (${source.location.address})` : ''}`);
    }
    lines.push('');

    source.messages.forEach((msg, idx) => {
      lines.push(`## ${msg.role === 'user' ? 'Journal Entry' : 'Gemini Reflection'} — ${new Date(msg.timestamp).toLocaleString()}`);
      lines.push('');
      lines.push(msg.role === 'user' ? msg.content : msg.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    });

    if (source.summary) {
      lines.push('## Executive Summary');
      lines.push('');
      lines.push(`> ${source.summary}`);
      lines.push('');
    }

    if (source.tags && source.tags.length > 0) {
      lines.push('## Tags');
      lines.push('');
      lines.push(source.tags.map((t) => `#${t}`).join(' '));
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(source.title || 'reflection').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'reflection'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Exported as Markdown.');
  };

  const messageStats = useMemo(() => {
    let words = 0;
    let chars = 0;
    for (const msg of currentMessages) {
      const trimmed = msg.content.trim();
      chars += trimmed.length;
      words += trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    }
    const readMinutes = Math.max(1, Math.round(words / 200));
    return { words, chars, readMinutes };
  }, [currentMessages]);

  /**
   * Guaranteed Transaction Verification & Resilience
   * 1. Calls server-side Gemini API with Fallback Ladder.
   * 2. Persists prompt and response together to Cloud Firestore (/users/{userId}/interactions/{interactionId}).
   * 3. Retains user input buffer on any failure so user data is never lost.
   */
  const handleSendReflection = async (forcedPrompt?: string) => {
    const promptToSend = (forcedPrompt || inputBuffer).trim();
    if (!promptToSend || isGenerating) return;

    setErrorMessage(null);
    setIsGenerating(true);
    setSaveStatus('saving');

    const activeTitle = title.trim() || promptToSend.slice(0, 40) + '...';
    if (!title.trim()) {
      setTitle(activeTitle);
    }

    const currentInteractionId = interaction?.id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const currentMessages: JournalMessage[] = interaction?.messages ? [...interaction.messages] : [];

    const userMessage: JournalMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: promptToSend,
      timestamp: new Date().toISOString(),
    };

    const optimisticMessages = [...currentMessages, userMessage];

    try {
      // 1. Call Gemini Server API (via the AI service, skill Phase 5)
      const data = await callReflect({
        prompt: promptToSend,
        mode,
        title: activeTitle,
        location,
        history: currentMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      // 2. Formulate model response message
      const modelMessage: JournalMessage = {
        id: `msg_gemini_${Date.now()}`,
        role: 'model',
        content: data.reply,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...optimisticMessages, modelMessage];
      const nowIso = new Date().toISOString();

      const updatedInteraction: JournalInteraction = {
        id: currentInteractionId,
        userId,
        title: activeTitle,
        mode,
        messages: updatedMessages,
        summary: data.summary || interaction?.summary,
        tags: data.tags || interaction?.tags || ['Reflection'],
        modelUsed: data.modelUsed || 'gemini-3.6-flash',
        location: location || interaction?.location || undefined,
        createdAt: interaction?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      // 3. Persist to Firestore (/users/{userId}/interactions/{interactionId})
      await saveUserInteraction(userId, updatedInteraction);

      // 4. Update UI & clear input buffer only upon verified save
      onInteractionUpdated(updatedInteraction);
      setInputBuffer('');
      setSaveStatus('saved');
      setIsGenerating(false);
    } catch (err: any) {
      console.error('Reflection / Save failed:', err);
      setSaveStatus('error');
      setErrorMessage(
        err.message || 'Failed to complete reflection or save to Firestore. Your input is preserved below.'
      );
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0B] text-[#E0E0E0] overflow-hidden">
      {/* Workspace Header */}
      <div className="shrink-0 border-b border-[#262629] bg-[#121214] px-6 py-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Title Editor */}
          <input
            id="journal-title-input"
            type="text"
            placeholder="Untitled Reflection..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-serif text-xl sm:text-2xl font-bold text-[#F1F1F1] bg-transparent placeholder:text-[#555] focus:outline-none focus:ring-0 w-full"
          />

          {/* Status badge */}
          <div className="flex items-center gap-2 shrink-0 text-xs">
            {isTitleSaving && (
              <span className="flex items-center gap-1 text-[#666] font-medium">
                <Save className="h-3.5 w-3.5 animate-pulse" />
                <span>Saving title...</span>
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-amber-400 font-medium">
                <Clock className="h-3.5 w-3.5 animate-spin" />
                <span>Processing & Saving...</span>
              </span>
            )}
            {saveStatus === 'saved' && (
              <span
                id="firestore-saved-indicator"
                className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-md font-medium"
                title={`Saved to Firestore: /users/${userId}/interactions/${interaction?.id || ''}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>Saved to Firestore</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-400 font-medium bg-red-950/40 border border-red-800/40 px-2 py-0.5 rounded-md">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Save Error</span>
              </span>
            )}

            {interaction?.modelUsed && (
              <span className="hidden md:inline-flex items-center rounded-md bg-[#1A1A1C] px-2 py-0.5 text-[11px] font-mono text-[#888] border border-[#262629]">
                {interaction.modelUsed}
              </span>
            )}

            {/* Export current entry as Markdown */}
            <button
              onClick={handleExportMarkdown}
              disabled={currentMessages.length === 0}
              className="flex items-center gap-1.5 rounded-lg border border-[#262629] bg-[#161619] px-2.5 py-1 text-xs font-medium text-[#A0A0A5] hover:bg-[#1E1E22] hover:text-[#F1F1F1] hover:border-[#3A3A40] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Download this reflection as a Markdown file"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 text-xs">
          {[
            { id: 'reflect', label: 'Thoughtful Reflection', icon: Brain, desc: 'Empathetic guidance' },
            { id: 'summarize', label: 'Executive Summary', icon: FileText, desc: 'Key takeaways' },
            { id: 'brainstorm', label: 'Brainstorm Ideas', icon: Lightbulb, desc: 'Fresh angles' },
            { id: 'chat', label: 'Continuous Dialogue', icon: MessageSquare, desc: 'Multi-turn conversation' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = mode === tab.id;
            return (
              <button
                key={tab.id}
                id={`mode-tab-${tab.id}`}
                onClick={() => setMode(tab.id as ReflectionMode)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#24242A] border border-[#3E3E44] text-[#F1F1F1] shadow-sm'
                    : 'bg-[#161619] border border-[#262629] text-[#888] hover:text-[#E0E0E0] hover:bg-[#1C1C20]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Location Picker */}
        <div className="flex items-center gap-3 pt-1">
          <LocationPicker location={location} onLocationChange={setLocation} />
          {location && (
            <span className="text-[10px] text-[#666] flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />
              Pinned to entry
            </span>
          )}
        </div>
      </div>

      {/* Main Conversation / Reflection Canvas */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 bg-[#0A0A0B]">
        {/* Error Escalation Banner */}
        {errorMessage && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-xs text-red-300 flex items-start justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-200">Transaction Notice</p>
                <p className="mt-0.5 text-red-300/90">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={() => handleSendReflection()}
              className="flex items-center gap-1 rounded-md bg-red-900/80 px-2.5 py-1 text-white font-medium hover:bg-red-800 transition-colors shrink-0"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Retry Save</span>
            </button>
          </div>
        )}

        {/* Empty state / Welcome prompt */}
        {currentMessages.length === 0 && (
          <div className="mx-auto max-w-2xl text-center py-12 px-4 space-y-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1A1A1C] border border-[#262629] text-amber-400 shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-serif text-2xl font-bold text-[#F1F1F1]">
                What is on your mind today?
              </h3>
              <p className="text-sm text-[#888] max-w-md mx-auto">
                Write down your thoughts, reflections, or challenges. Gemini 3.6 Flash will assist with constructive perspectives, summarization, and creative brainstorming.
              </p>
            </div>

            {/* Quick Inspiration Prompts */}
            <div className="pt-2 text-left">
              <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-2 text-center">
                Inspiration Prompts
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {promptSuggestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputBuffer(item.text);
                      textareaRef.current?.focus();
                    }}
                    className="flex flex-col items-start p-3 rounded-xl border border-[#262629] bg-[#121214] hover:border-[#3E3E44] hover:bg-[#161619] text-left transition-all group"
                  >
                    <span className="text-xs font-semibold text-[#F1F1F1] group-hover:text-amber-400">
                      {item.label}
                    </span>
                    <span className="text-[11px] text-[#888] mt-1 line-clamp-2">
                      {item.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Multi-turn Messages Timeline */}
        {currentMessages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col max-w-3xl ${isUser ? 'ml-auto items-end' : 'mr-auto items-start'}`}
            >
              {/* Sender label and timestamp */}
              <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-[#666]">
                <span className="font-medium text-[#888]">
                  {isUser ? 'Your Journal Entry' : 'Gemini Reflection'}
                </span>
                <span>•</span>
                <span>
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Message Bubble */}
              <div
                className={`relative group rounded-2xl p-4 sm:p-5 text-sm leading-relaxed transition-all shadow-sm ${
                  isUser
                    ? 'bg-[#1A1A1C] border border-[#2E2E34] text-[#F1F1F1] rounded-br-xs whitespace-pre-wrap'
                    : 'bg-[#121214] border border-[#262629] text-[#E0E0E0] rounded-bl-xs w-full'
                }`}
              >
                {isUser ? (
                  <div>{msg.content}</div>
                ) : (
                  <div className="space-y-3">
                    <div className="prose prose-invert max-w-none text-[#E0E0E0] text-sm leading-relaxed">
                      <Markdown>{msg.content}</Markdown>
                    </div>

                    {/* Copy action button */}
                    <div className="pt-2 flex items-center justify-between border-t border-[#262629] text-xs text-[#666]">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-amber-400" />
                        <span className="text-[11px] font-medium text-[#888]">{activeModel}</span>
                      </div>
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.content)}
                        className="flex items-center gap-1 rounded p-1 text-[#666] hover:text-[#E0E0E0] hover:bg-[#1A1A1C] transition-colors"
                        title="Copy reflection"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span className="text-[10px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Executive Summary Card (if interaction has a summary) */}
        {interaction?.summary && currentMessages.length > 0 && (
          <div className="max-w-3xl mx-auto rounded-2xl border border-amber-900/40 bg-[#161410] p-4 shadow-xs">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <Brain className="h-3.5 w-3.5 text-amber-400" />
              Executive Reflection Summary
            </div>
            <p className="text-xs text-[#D5D5DB] leading-relaxed italic">
              "{interaction.summary}"
            </p>
            {/* Location tag in summary */}
            {interaction.location && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#888]">
                <MapPin className="h-2.5 w-2.5 text-emerald-400" />
                <span>{interaction.location.placeName}</span>
                {interaction.location.address && (
                  <span className="text-[#666]">— {interaction.location.address}</span>
                )}
              </div>
            )}
            {interaction.tags && interaction.tags.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                <Tag className="h-3 w-3 text-amber-400" />
                {interaction.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-[#1A1A1C] border border-amber-900/40 px-2 py-0.5 text-[10px] font-medium text-amber-300"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Loading Bubble */}
        {isGenerating && (
          <div className="flex flex-col max-w-3xl mr-auto items-start">
            <div className="flex items-center gap-2 mb-1 px-1 text-[11px] text-[#666]">
              <span className="font-medium text-[#888]">{activeModel}</span>
              <span>•</span>
              <span>Reflecting...</span>
            </div>
            <div className="rounded-2xl rounded-bl-xs border border-[#262629] bg-[#121214] p-4 shadow-sm flex items-center gap-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <p className="text-xs text-[#A0A0A5] font-medium">
                Analyzing reflection and generating constructive insights...
              </p>
            </div>
          </div>
        )}

        {/* Visual prompt divider if thread has messages */}
        {currentMessages.length > 0 && (
          <div className="max-w-3xl mx-auto flex items-center justify-center gap-3 py-2">
            <div className="h-px bg-[#262629] flex-1" />
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#161619] border border-amber-900/40 text-[11px] font-medium text-amber-300 shadow-xs">
              <MessageSquare className="h-3 w-3 text-amber-400" />
              Follow-up & continue reflection below
            </span>
            <div className="h-px bg-[#262629] flex-1" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Composer Box (Permanently Docked) */}
      <div className="shrink-0 border-t border-[#262629] bg-[#121214] p-4 sm:p-5">
        <div className="max-w-3xl mx-auto space-y-2.5">
          {/* Header identifying the Follow-up Input Box */}
          {currentMessages.length > 0 ? (
            <div className="flex items-center justify-between pb-0.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <MessageSquare className="h-3.5 w-3.5 text-amber-400" />
                <span>Follow-Up Input Box</span>
              </div>
              <span className="text-[11px] text-[#888] font-mono">
                Thread Turn {Math.floor(currentMessages.length / 2) + 1}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between pb-0.5">
              <div className="flex items-center gap-2 text-xs font-medium text-[#888]">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Write Your Reflection</span>
              </div>
              <span className="text-[11px] text-[#666]">New Journal Entry</span>
            </div>
          )}

          {/* Quick chips if in conversation */}
          {currentMessages.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] text-[#888]">
              <span className="font-medium text-[#666] shrink-0">Quick prompts:</span>
              <button
                onClick={() => handleSendReflection('How can we avoid burnout while keeping this pace?')}
                className="rounded-full bg-[#161619] border border-amber-900/40 hover:border-amber-500/50 hover:bg-[#202024] px-2.5 py-0.5 text-amber-300 hover:text-amber-200 whitespace-nowrap transition-colors"
              >
                Avoid burnout?
              </button>
              <button
                onClick={() => handleSendReflection('Give me 3 concrete action steps for tomorrow based on this.')}
                className="rounded-full bg-[#161619] border border-[#262629] hover:bg-[#202024] hover:border-[#3A3A40] px-2.5 py-0.5 text-[#A0A0A5] hover:text-[#F1F1F1] whitespace-nowrap transition-colors"
              >
                3 action steps
              </button>
              <button
                onClick={() => handleSendReflection('How can I reframe this challenge into a learning opportunity?')}
                className="rounded-full bg-[#161619] border border-[#262629] hover:bg-[#202024] hover:border-[#3A3A40] px-2.5 py-0.5 text-[#A0A0A5] hover:text-[#F1F1F1] whitespace-nowrap transition-colors"
              >
                Reframe as opportunity
              </button>
              <button
                onClick={() => handleSendReflection('Summarize the emotional core of this reflection.')}
                className="rounded-full bg-[#161619] border border-[#262629] hover:bg-[#202024] hover:border-[#3A3A40] px-2.5 py-0.5 text-[#A0A0A5] hover:text-[#F1F1F1] whitespace-nowrap transition-colors"
              >
                Emotional core
              </button>
            </div>
          )}

          {/* Text Area */}
          <div
            className={`relative rounded-2xl border bg-[#161619] focus-within:bg-[#18181C] transition-all shadow-xs ${
              currentMessages.length > 0
                ? 'border-amber-900/40 focus-within:border-amber-500/50'
                : 'border-[#262629] focus-within:border-[#444]'
            }`}
          >
            <textarea
              ref={textareaRef}
              id="reflection-input"
              data-testid="follow-up-input"
              rows={3}
              placeholder={
                currentMessages.length === 0
                  ? 'Write your journal entry or reflection here... (Shift + Enter for new line)'
                  : 'Type a follow-up thought, question, or next step for Gemini... (e.g. How can we avoid burnout while keeping this pace?)'
              }
              value={inputBuffer}
              onChange={(e) => setInputBuffer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReflection();
                }
              }}
              className="w-full resize-none bg-transparent p-3.5 pr-28 text-sm text-[#F1F1F1] placeholder:text-[#666] focus:outline-none"
            />

            {/* Bottom Action Controls inside textarea */}
            <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
              <span className="text-[10px] text-[#666] font-mono hidden sm:inline-block">
                {inputBuffer.length} chars
              </span>
              <button
                id="submit-reflection-btn"
                onClick={() => handleSendReflection()}
                disabled={!inputBuffer.trim() || isGenerating}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                  currentMessages.length > 0
                    ? 'bg-amber-500/15 border border-amber-500/40 text-amber-200 hover:bg-amber-500/25 hover:border-amber-400/60'
                    : 'bg-[#1A1A1C] border border-[#333338] text-[#F1F1F1] hover:bg-[#242428] hover:border-[#44444C]'
                }`}
                title="Send to Gemini & Save to Firestore"
              >
                {isGenerating ? (
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                <span>{currentMessages.length > 0 ? 'Send' : 'Reflect'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#666] px-1">
            <span>
              Press <kbd className="rounded bg-[#161619] border border-[#262629] px-1 py-0.5 font-mono text-[10px] text-[#888]">Enter</kbd> to {currentMessages.length > 0 ? 'send follow-up' : 'reflect'}, <kbd className="rounded bg-[#161619] border border-[#262629] px-1 py-0.5 font-mono text-[10px] text-[#888]">Shift+Enter</kbd> for new line
            </span>
            <span className="flex items-center gap-3">
              {currentMessages.length > 0 ? (
                <span className="font-mono">
                  {messageStats.words.toLocaleString()} words · ~{messageStats.readMinutes} min read
                </span>
              ) : null}
              <span className="text-emerald-400 font-medium">
                Firestore Protected Partition
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
