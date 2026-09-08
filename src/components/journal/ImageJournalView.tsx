import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Image as ImageIcon,
  Upload,
  Trash2,
  AlertCircle,
  RotateCcw,
  Maximize2,
  X,
  Sparkles,
  ShieldCheck,
  Eye,
  FileText,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import type { Attachment } from '../../data/models';
import {
  validateImageFile,
  uploadImageAttachment,
  analyzeImageContext,
  MAX_IMAGE_SIZE_BYTES,
  ALLOWED_IMAGE_MIME_TYPES,
  ImageValidationError,
  type ImageContextOutput,
} from '../../services/imageJournaling';

export interface ImageDraftPayload {
  body: string;
  caption?: string;
  summary?: string;
  emotion?: string;
  tags?: string[];
  suggestedTags?: string[];
  modelUsed?: string;
}

export interface ImageJournalViewProps {
  attachments: Attachment[];
  currentUserId: string;
  onAddAttachment?: (attachment: Attachment) => void;
  onRemoveAttachment?: (attachmentId: string) => void;
  onUseDraft?: (draft: ImageDraftPayload) => void;
  disabled?: boolean;
  className?: string;
}

export const ImageJournalView: React.FC<ImageJournalViewProps> = ({
  attachments,
  currentUserId,
  onAddAttachment,
  onRemoveAttachment,
  onUseDraft,
  disabled = false,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [lightboxImage, setLightboxImage] = useState<Attachment | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<ImageContextOutput | null>(null);
  const [analyzingImageId, setAnalyzingImageId] = useState<string | null>(null);
  const [analyzingImageCaption, setAnalyzingImageCaption] = useState<string>('');
  const [localFiles, setLocalFiles] = useState<Record<string, File>>({});

  const imageAttachments = attachments.filter((att) => att.kind === 'image');

  // Select File Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFileUpload(file);
  };

  // Process File Upload
  const processFileUpload = async (file: File, mockFailure = false) => {
    setUploadError(null);
    setFailedFile(null);

    // Client-side Validation
    const validation = validateImageFile(file, currentUserId);
    if (!validation.ok) {
      setUploadError(validation.error || 'Validation failed.');
      setFailedFile(file);
      return;
    }

    setUploading(true);
    try {
      const newAtt = await uploadImageAttachment({
        file,
        currentUserId,
        mockFailure,
      });
      setLocalFiles((prev) => ({ ...prev, [newAtt.id]: file }));
      onAddAttachment?.(newAtt);
    } catch (err) {
      setUploadError((err as Error).message || 'Upload failed.');
      setFailedFile(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Retry Upload Handler
  const handleRetry = () => {
    if (failedFile) {
      processFileUpload(failedFile, false);
    }
  };

  // Gemini AI Image Context Analysis Handler
  const handleAnalyzeImage = async (att: Attachment) => {
    const file = localFiles[att.id];
    if (!file) {
      setUploadError('The original image is no longer available for analysis. Re-upload it first.');
      return;
    }
    setAnalyzingImageId(att.id);
    setUploadError(null);
    try {
      const result = await analyzeImageContext({
        file,
        imageName: att.caption || 'Journal Photo',
        userCaption: att.caption,
        currentUserId,
      });
      setAiAnalysis(result);
      setAnalyzingImageCaption(att.caption || 'Journal Photo');
    } catch (err) {
      const message = (err as Error).message || 'Visual analysis failed.';
      if (err instanceof ImageValidationError) {
        setAnalyzingImageId(null);
        setUploadError(message);
        return;
      }
      setUploadError(message);
    } finally {
      setAnalyzingImageId(null);
    }
  };

  const handleRemoveAttachment = (attId: string) => {
    setLocalFiles((prev) => {
      const next = { ...prev };
      delete next[attId];
      return next;
    });
    onRemoveAttachment?.(attId);
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Dropzone & Controls */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
            <ImageIcon className="w-4 h-4 text-purple-400" />
            <span>Image Journaling & Attachments</span>
            <span className="text-xs text-slate-500 font-normal">
              ({imageAttachments.length} images)
            </span>
          </div>

          <span className="text-[11px] text-slate-400">
            Max 10MB • JPG, PNG, WEBP, GIF, HEIC, AVIF
          </span>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Upload Trigger Area */}
        <div
          onClick={() => !uploading && !disabled && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300 ${
            uploading
              ? 'border-purple-500/50 bg-purple-500/5 cursor-wait'
              : 'border-slate-800 hover:border-purple-500/40 hover:bg-slate-950/60'
          }`}
        >
          <div className="mx-auto w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-2">
            <Upload className="w-5 h-5" />
          </div>
          <div className="text-xs font-semibold text-slate-200">
            {uploading ? 'Uploading Image...' : 'Click or drop an image here to attach'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Stored privately under your user account; analyzed in-flight with your authorized Gemini session
          </div>
        </div>

        {/* Upload Error & Retry Banner */}
        {uploadError && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 flex items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>

            {failedFile && (
              <button
                onClick={handleRetry}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-900 hover:bg-rose-800 text-white font-semibold transition shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Attachments Preview Grid */}
      {imageAttachments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Attached Photographs
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {imageAttachments.map((att) => (
              <div
                key={att.id}
                className="group relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all shadow-md"
              >
                <img
                  src={att.url}
                  alt={att.caption || 'Journal photo'}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-32 object-cover transition-transform duration-300 group-hover:scale-105"
                />

                {/* Overlay Action Buttons */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                  <button
                    onClick={() => setLightboxImage(att)}
                    className="p-2 rounded-lg bg-slate-800/90 text-slate-200 hover:bg-purple-600 transition"
                    title="View Full Preview"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleAnalyzeImage(att)}
                    className="p-2 rounded-lg bg-slate-800/90 text-amber-300 hover:bg-amber-600 hover:text-white transition"
                    title="Analyze Visual Context with Gemini AI"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>

                  {onRemoveAttachment && (
                    <button
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="p-2 rounded-lg bg-slate-800/90 text-rose-400 hover:bg-rose-600 hover:text-white transition"
                      title="Remove Attachment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gemini Image Context Analysis Panel */}
      <AnimatePresence>
        {aiAnalysis && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-6 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-4 backdrop-blur-md shadow-2xl relative"
          >
            <button
              onClick={() => setAiAnalysis(null)}
              className="absolute right-4 top-4 p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>GEMINI VISUAL CONTEXT ASSISTANT</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* 1. Observed Visuals */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-sky-400" />
                  <span>Observed Visuals</span>
                </div>
                <ul className="space-y-1 text-slate-300">
                  {aiAnalysis.observed.map((obs, i) => (
                    <li key={i}>• {obs}</li>
                  ))}
                </ul>
              </div>

              {/* 2. User Provided */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-400" />
                  <span>User Provided</span>
                </div>
                <ul className="space-y-1 text-slate-300">
                  {aiAnalysis.userProvided.map((up, i) => (
                    <li key={i}>• {up}</li>
                  ))}
                </ul>
              </div>

              {/* 3. AI Inferred Reflections */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <div className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Inferred Reflections</span>
                </div>
                <ul className="space-y-1 text-slate-300">
                  {aiAnalysis.aiInferred.map((inf, i) => (
                    <li key={i}>• {inf}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Anti-Fabrication Safeguard Disclaimer */}
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{aiAnalysis.disclaimer}</span>
            </div>

            {/* Gemini reflection — review then apply as journal draft */}
            {aiAnalysis.body?.trim() && (
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                    <FileText className="w-3.5 h-3.5 text-purple-400" />
                    <span>GEMINI REFLECTION</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {aiAnalysis.emotion && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                        {aiAnalysis.emotion}
                      </span>
                    )}
                    {aiAnalysis.modelUsed && (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-500 border border-slate-800">
                        {aiAnalysis.modelUsed}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{aiAnalysis.body}</p>

                {aiAnalysis.summary && (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <span className="font-semibold text-slate-300">Summary:</span> {aiAnalysis.summary}
                  </p>
                )}

                {aiAnalysis.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {aiAnalysis.tags.map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      onUseDraft?.({
                        body: aiAnalysis.body,
                        caption: analyzingImageCaption,
                        summary: aiAnalysis.summary,
                        emotion: aiAnalysis.emotion,
                        suggestedTags: aiAnalysis.tags,
                        modelUsed: aiAnalysis.modelUsed,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/30 transition"
                    title="Open an editable entry pre-filled with this AI reflection"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Use as Journal Draft</span>
                  </button>
                  <span className="text-[11px] text-slate-500">
                    Opens an editable draft — nothing is published until you save it.
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {lightboxImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4 shadow-2xl flex flex-col items-center"
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute right-4 top-4 p-2 rounded-full bg-slate-950/80 text-slate-300 hover:text-white transition z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <img
                src={lightboxImage.url}
                alt={lightboxImage.caption || 'Journal preview'}
                className="max-h-[75vh] w-auto object-contain rounded-xl"
              />

              {lightboxImage.caption && (
                <div className="text-xs text-slate-300 text-center font-medium">
                  {lightboxImage.caption}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
