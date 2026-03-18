"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { OnboardingData, Niche } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Upload, FileText, File, X, Plus, CheckCircle2 } from "lucide-react";
import RealEstateNiche from "./niches/real-estate";
import VoicemailNiche from "./niches/voicemail";
import RestaurantNiche from "./niches/restaurant";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const NICHE_COMPONENTS: Partial<Record<Niche, React.ComponentType<{ data: OnboardingData; onChange: (key: string, value: string | string[] | boolean) => void }>>> = {
  real_estate: RealEstateNiche,
  voicemail: VoicemailNiche,
  restaurant: RestaurantNiche,
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const ACCEPTED_EXTENSIONS = [".pdf", ".txt", ".docx"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 3;

const DEFAULT_FAQ: Record<string, { question: string; answer: string }[]> = {
  auto_glass: [
    { question: "What types of windshields do you repair?", answer: "" },
    { question: "Do you offer mobile service?", answer: "" },
    { question: "How long does a replacement take?", answer: "" },
  ],
  hvac: [
    { question: "Do you service all brands?", answer: "" },
    { question: "Do you offer emergency service?", answer: "" },
    { question: "What areas do you cover?", answer: "" },
  ],
  plumbing: [
    { question: "Do you handle emergency calls?", answer: "" },
    { question: "What areas do you service?", answer: "" },
    { question: "Do you give free estimates?", answer: "" },
  ],
  dental: [
    { question: "Are you accepting new patients?", answer: "" },
    { question: "What insurance do you accept?", answer: "" },
    { question: "Do you offer emergency appointments?", answer: "" },
  ],
  legal: [
    { question: "What areas of law do you practice?", answer: "" },
    { question: "Do you offer free consultations?", answer: "" },
    { question: "What are your fees?", answer: "" },
  ],
  salon: [
    { question: "Do you accept walk-ins?", answer: "" },
    { question: "What services do you offer?", answer: "" },
    { question: "How do I book an appointment?", answer: "" },
  ],
  print_shop: [
    { question: "What file formats do you accept?", answer: "" },
    { question: "What's your turnaround time?", answer: "" },
    { question: "Do you offer design services?", answer: "" },
  ],
  property_management: [
    { question: "How do I submit a maintenance request?", answer: "" },
    { question: "What are the office hours?", answer: "" },
    { question: "How do I pay rent?", answer: "" },
  ],
  other: [
    { question: "What services do you offer?", answer: "" },
    { question: "What are your hours?", answer: "" },
    { question: "How can I reach someone?", answer: "" },
  ],
};

function getFileIcon(filename: string) {
  if (filename.endsWith(".pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (filename.endsWith(".docx")) return <FileText className="h-4 w-4 text-blue-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

function getIntakeId(): string {
  const storageKey = "unmissed_onboard_intake_id";
  const existing = typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
  if (existing) return existing;
  const id = crypto.randomUUID();
  if (typeof window !== "undefined") localStorage.setItem(storageKey, id);
  return id;
}

export default function Step4({ data, onUpdate }: Props) {
  const niche = data.niche;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Ensure a draft intake_submissions row exists so knowledge uploads can pass FK validation
  useEffect(() => {
    const intakeId = getIntakeId();
    fetch("/api/onboard/create-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intake_id: intakeId, niche: niche || "other" }),
    }).catch(() => {/* silent — best-effort */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize FAQ pairs on first visit if empty and niche has defaults
  const initFaqIfNeeded = useCallback(() => {
    if (data.faqPairs.length === 0 && niche && !NICHE_COMPONENTS[niche as Niche]) {
      const defaults = DEFAULT_FAQ[niche] || DEFAULT_FAQ.other;
      if (defaults) {
        onUpdate({ faqPairs: defaults.map((d) => ({ ...d })) });
      }
    }
  }, [data.faqPairs.length, niche, onUpdate]);

  // Run init on mount
  useEffect(() => {
    initFaqIfNeeded();
  }, [initFaqIfNeeded]);

  const handleNicheChange = (key: string, value: string | string[] | boolean) => {
    onUpdate({
      nicheAnswers: { ...data.nicheAnswers, [key]: value },
    });
  };

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !ACCEPTED_EXTENSIONS.includes(`.${ext}`)) {
        return `${file.name}: Only PDF, TXT, and DOCX files are accepted.`;
      }
    }
    if (file.size > MAX_FILE_SIZE) {
      return `${file.name}: File exceeds 5MB limit.`;
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      setUploadError(error);
      return;
    }

    if (data.knowledgeDocs.length >= MAX_FILES) {
      setUploadError(`Maximum ${MAX_FILES} files allowed.`);
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("intake_id", getIntakeId());

      const res = await fetch("/api/client/knowledge/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }

      const result = await res.json();
      onUpdate({
        knowledgeDocs: [
          ...data.knowledgeDocs,
          {
            id: result.id || crypto.randomUUID(),
            filename: file.name,
            charCount: result.charCount || 0,
          },
        ],
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      uploadFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeDoc = (docId: string) => {
    onUpdate({
      knowledgeDocs: data.knowledgeDocs.filter((d) => d.id !== docId),
    });
  };

  const updateFaqQuestion = (index: number, question: string) => {
    const updated = [...data.faqPairs];
    updated[index] = { ...updated[index], question };
    onUpdate({ faqPairs: updated });
  };

  const updateFaqAnswer = (index: number, answer: string) => {
    const updated = [...data.faqPairs];
    updated[index] = { ...updated[index], answer };
    onUpdate({ faqPairs: updated });
  };

  const addFaqPair = () => {
    if (data.faqPairs.length >= 8) return;
    onUpdate({
      faqPairs: [...data.faqPairs, { question: "", answer: "" }],
    });
  };

  const removeFaqPair = (index: number) => {
    const updated = data.faqPairs.filter((_, i) => i !== index);
    onUpdate({ faqPairs: updated });
  };

  if (!niche) {
    return (
      <div className="text-center py-8 text-muted-foreground/70">
        Please go back and select your industry first.
      </div>
    );
  }

  const NicheComponent = NICHE_COMPONENTS[niche as Niche] || null;
  const showFaqEditor = !NicheComponent;

  return (
    <div className="space-y-8">
      {/* Section A: Knowledge Base Upload */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Teach your agent</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload documents so your agent can answer detailed questions. Optional — you can add more later.
          </p>
        </div>

        {data.websiteUrl && (() => {
          const scrapedFaqCount = data.faqPairs.filter(p => p.answer.trim()).length;
          return (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                {scrapedFaqCount > 0
                  ? `Loaded ${scrapedFaqCount} FAQ${scrapedFaqCount !== 1 ? 's' : ''} from your website — review and edit below`
                  : `Website content loaded — add your FAQ answers below`}
              </p>
            </div>
          );
        })()}

        {/* Drop zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all ${
            isDragging
              ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
              : "border-border/80 hover:border-border bg-muted/20"
          } ${data.knowledgeDocs.length >= MAX_FILES ? "opacity-50 pointer-events-none" : ""}`}
        >
          <Upload
            className={`h-8 w-8 mb-2 ${isDragging ? "text-indigo-500" : "text-muted-foreground/70"}`}
          />
          <p className="text-sm font-medium text-foreground">
            {uploading ? "Uploading..." : "Drop files here or click to upload"}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            PDF, TXT, or DOCX — max 5MB per file, up to {MAX_FILES} files
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {uploadError && (
          <p className="text-xs text-red-600">{uploadError}</p>
        )}

        {/* Uploaded files list */}
        {data.knowledgeDocs.length > 0 && (
          <div className="space-y-2">
            {data.knowledgeDocs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getFileIcon(doc.filename)}
                  <span className="text-sm text-foreground truncate">{doc.filename}</span>
                  {doc.charCount > 0 && (
                    <span className="flex-shrink-0 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {doc.charCount.toLocaleString()} chars
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeDoc(doc.id)}
                  className="text-muted-foreground/70 hover:text-red-500 transition-colors p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section B: Niche-specific content OR FAQ editor */}
      {NicheComponent ? (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Your services</h3>
            <p className="text-sm text-muted-foreground mt-1">
              These help your agent give accurate answers to callers.
            </p>
          </div>
          <NicheComponent data={data} onChange={handleNicheChange} />
        </div>
      ) : showFaqEditor ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Common questions</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add questions your callers frequently ask. Your agent will use your answers.
            </p>
          </div>

          <div className="space-y-4">
            {data.faqPairs.map((pair, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Question {index + 1}</label>
                    <Input
                      value={pair.question}
                      onChange={(e) => updateFaqQuestion(index, e.target.value)}
                      placeholder="e.g. What are your hours?"
                    />
                  </div>
                  {data.faqPairs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFaqPair(index)}
                      className="text-muted-foreground/70 hover:text-red-500 transition-colors p-1 mt-5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground">Answer</label>
                    {pair.source === 'scraped' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI filled
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={pair.answer}
                    onChange={(e) => updateFaqAnswer(index, e.target.value)}
                    placeholder="Type the answer your agent should give..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>
              </div>
            ))}
          </div>

          {data.faqPairs.length < 8 && (
            <button
              type="button"
              onClick={addFaqPair}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add another question
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
