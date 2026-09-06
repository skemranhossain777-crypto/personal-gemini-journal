import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  MicOff,
  Square,
  Pause,
  Play,
  RotateCcw,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Volume2,
  FileText,
  Clock,
  Save,
  Radio,
} from 'lucide-react';
import {
  transcribeAudioBlob,
  cleanTranscriptText,
  MAX_RECORDING_DURATION_SECONDS,
  VoiceTranscriptionError,
} from '../../services/voiceTranscription';
import type { JournalEntry, ReflectionMode } from '../../data/models';

export type VoiceState = 'idle' | 'recording' | 'paused' | 'transcribing' | 'review' | 'error';

export interface VoiceJournalViewProps {
  onSaveDraft?: (draft: {
    title: string;
    body: string;
    mode: ReflectionMode;
    tags: string[];
    keepAudioAttachment: boolean;
    audioBlob?: Blob;
  }) => void;
  onCancel?: () => void;
  className?: string;
}

export const VoiceJournalView: React.FC<VoiceJournalViewProps> = ({
  onSaveDraft,
  onCancel,
  className = '',
}) => {
  const [state, setState] = useState<VoiceState>('idle');
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Review Draft State
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [draftBody, setDraftBody] = useState<string>('');
  const [draftMode, setDraftMode] = useState<ReflectionMode>('free-write');
  const [draftTags, setDraftTags] = useState<string[]>(['voice-journal']);
  const [keepAudioAttachment, setKeepAudioAttachment] = useState<boolean>(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);

  // Recording timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer logic for active recording
  useEffect(() => {
    if (state === 'recording') {
      timerRef.current = setInterval(() => {
        setDurationSeconds((prev) => {
          if (prev >= MAX_RECORDING_DURATION_SECONDS - 1) {
            handleStopAndTranscribe();
            return MAX_RECORDING_DURATION_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state]);

  // Start recording
  const handleStartRecording = async () => {
    try {
      setErrorMessage('');
      setDurationSeconds(0);
      setAudioBlob(null);

      // Verify mic permissions if in browser
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      setState('recording');
    } catch {
      setErrorMessage('Microphone access denied. Please enable microphone permissions in your browser to use voice journaling.');
      setState('error');
    }
  };

  // Pause recording
  const handlePauseRecording = () => {
    setState('paused');
  };

  // Resume recording
  const handleResumeRecording = () => {
    setState('recording');
  };

  // Stop recording and trigger transcription
  const handleStopAndTranscribe = async (mockFailure = false) => {
    setState('transcribing');

    try {
      // Create audio blob
      const dummyAudioBlob = new Blob(['simulated-voice-audio-data'], { type: 'audio/webm' });
      setAudioBlob(dummyAudioBlob);

      const result = await transcribeAudioBlob(dummyAudioBlob, { mockFailure });
      const cleanedText = cleanTranscriptText(result.transcript);

      setDraftTitle(`Voice Reflection — ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`);
      setDraftBody(cleanedText);
      setState('review');
    } catch (err) {
      if (err instanceof VoiceTranscriptionError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Transcription failed. Please retry your recording.');
      }
      setState('error');
    }
  };

  // Cancel recording and reset
  const handleCancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDurationSeconds(0);
    setAudioBlob(null);
    setDraftTitle('');
    setDraftBody('');
    setState('idle');
    onCancel?.();
  };

  // Optional AI metadata generation for transcript
  const handleGenerateAiMetadata = () => {
    setIsGeneratingAi(true);
    setTimeout(() => {
      setDraftTags((prev) => Array.from(new Set([...prev, 'reflection', 'mindfulness', 'voice'])));
      setIsGeneratingAi(false);
    }, 500);
  };

  // Save final draft
  const handleSaveDraft = () => {
    if (!draftBody.trim()) return;

    onSaveDraft?.({
      title: draftTitle.trim() || 'Voice Entry',
      body: draftBody.trim(),
      mode: draftMode,
      tags: draftTags,
      keepAudioAttachment,
      audioBlob: keepAudioAttachment && audioBlob ? audioBlob : undefined,
    });
  };

  // Format MM:SS timer string
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* State: Idle */}
      {state === 'idle' && (
        <div className="text-center py-12 px-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-6 backdrop-blur-md">
          <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-purple-500/10 animate-ping" />
            <button
              onClick={handleStartRecording}
              className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center shadow-xl shadow-purple-600/30 hover:scale-105 transition duration-300"
              aria-label="Start Voice Recording"
            >
              <Mic className="w-9 h-9" />
            </button>
          </div>

          <div className="space-y-2 max-w-sm mx-auto">
            <h3 className="text-lg font-bold text-slate-100">Voice Journal Reflection</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Speak freely. Your voice will be transcribed into an editable journal draft with complete privacy controls.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Max 5 minutes • Raw audio discarded by default</span>
          </div>
        </div>
      )}

      {/* State: Recording or Paused */}
      {(state === 'recording' || state === 'paused') && (
        <div className="text-center py-10 px-6 rounded-2xl bg-slate-900/90 border border-purple-500/40 space-y-6 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              {state === 'recording' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-3 w-3 ${state === 'recording' ? 'bg-rose-500' : 'bg-amber-400'}`} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              {state === 'recording' ? 'Recording Voice...' : 'Recording Paused'}
            </span>
          </div>

          {/* Large Timer Countdown */}
          <div className="space-y-1">
            <div className="text-4xl font-extrabold text-slate-100 tracking-tight font-mono">
              {formatTimer(durationSeconds)}
            </div>
            <div className="text-xs text-slate-400">
              {MAX_RECORDING_DURATION_SECONDS - durationSeconds}s remaining (Limit: 5:00)
            </div>
          </div>

          {/* Animated Waveform Bars */}
          <div className="flex items-center justify-center gap-1.5 h-12">
            {[40, 75, 50, 90, 60, 100, 45, 80, 55, 30].map((h, i) => (
              <div
                key={i}
                className={`w-1.5 rounded-full transition-all duration-300 ${
                  state === 'recording' ? 'bg-purple-500 animate-pulse' : 'bg-slate-700'
                }`}
                style={{ height: state === 'recording' ? `${h}%` : '20%' }}
              />
            ))}
          </div>

          {/* Action Controls */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <button
              onClick={handleCancelRecording}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>

            {state === 'recording' ? (
              <button
                onClick={handlePauseRecording}
                className="p-3 rounded-xl bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 hover:bg-amber-600/30 transition"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                onClick={handleResumeRecording}
                className="p-3 rounded-xl bg-purple-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-purple-500 transition"
              >
                <Play className="w-4 h-4" />
                <span>Resume</span>
              </button>
            )}

            <button
              onClick={() => handleStopAndTranscribe()}
              className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center gap-2 transition"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>Done & Transcribe</span>
            </button>
          </div>
        </div>
      )}

      {/* State: Transcribing */}
      {state === 'transcribing' && (
        <div className="text-center py-12 px-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 backdrop-blur-xl">
          <div className="mx-auto w-12 h-12 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
          <h3 className="text-base font-bold text-slate-200">Transcribing Voice Reflection...</h3>
          <p className="text-xs text-slate-400">Converting speech to editable journal text with local privacy safeguards.</p>
        </div>
      )}

      {/* State: Error State */}
      {state === 'error' && (
        <div className="p-6 rounded-2xl bg-rose-950/40 border border-rose-800/60 space-y-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-rose-200">Voice Recording Failure</h3>
            <p className="text-xs text-rose-300/90 max-w-md mx-auto leading-relaxed">
              {errorMessage || 'An error occurred during voice recording or transcription.'}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={handleCancelRecording}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleStartRecording}
              className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md shadow-purple-600/30 hover:bg-purple-500 transition"
            >
              Retry Recording
            </button>
          </div>
        </div>
      )}

      {/* State: Review & Editable Draft (NO Silent Publication) */}
      {state === 'review' && (
        <div className="space-y-6 rounded-2xl bg-slate-900/90 border border-slate-800 p-6 md:p-8 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 text-[11px] font-semibold">
                <FileText className="w-3.5 h-3.5" />
                <span>EDITABLE VOICE DRAFT</span>
              </div>
              <h3 className="text-lg font-bold text-slate-100">Review & Edit Your Voice Entry</h3>
            </div>

            <button
              onClick={handleGenerateAiMetadata}
              disabled={isGeneratingAi}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 border border-purple-700/40 text-purple-200 text-xs font-semibold transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{isGeneratingAi ? 'Analyzing...' : 'Generate AI Tags'}</span>
            </button>
          </div>

          {/* Editable Title & Body Inputs */}
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Journal Title</label>
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-400 mb-1">Transcribed Reflection (Editable)</label>
              <textarea
                rows={6}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder="Edit your transcribed voice reflection here..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-purple-500 leading-relaxed"
              />
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              {draftTags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                  #{t}
                </span>
              ))}
            </div>

            {/* Privacy Controls & Audio Attachment Toggle */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-200 select-none">
                <input
                  type="checkbox"
                  checked={keepAudioAttachment}
                  onChange={(e) => setKeepAudioAttachment(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
                />
                <span>Attach raw audio file to this entry</span>
              </label>

              <p className="text-[11px] text-slate-400 leading-relaxed pl-6">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400 inline mr-1" />
                Privacy Safeguard: By default, raw voice audio is processed locally and discarded upon saving. Your written transcript remains preserved.
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={handleStartRecording}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry Recording</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelRecording}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
              >
                Discard
              </button>

              <button
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition"
              >
                <Save className="w-4 h-4" />
                <span>Save Journal Entry</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
