import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { MicButton, type VoiceState } from "@/components/MicButton";
import { AnswerView } from "@/components/AnswerView";
import { NoteList } from "@/components/NoteList";
import {
  MicPermissionError,
  MicUnavailableError,
  MicUnsupportedError,
  isRecordingSupported,
  startRecording,
  type RecorderHandle,
} from "@/lib/recorder";
import { createWindowedGeminiSession } from "@/lib/transcription-windowed";
import type { TranscriptionSession } from "@/lib/transcription";
import { LATENCY_ENABLED, LatencyTracker, emptyStats, type LatencyStats } from "@/lib/latency";
import { answerQuestion } from "@/lib/voice.functions";
import { deleteNote, listNotes, saveNote, type VoiceNote } from "@/lib/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VoiceSearch — Ask out loud, get answers from the live web" },
      {
        name: "description",
        content:
          "Hold the button, speak your question, and get a concise answer grounded in current Google Search results, with sources.",
      },
      { property: "og:title", content: "VoiceSearch — Ask out loud, get live web answers" },
      {
        property: "og:description",
        content:
          "A voice-first research assistant: hold to speak, see live transcription, release for a fast grounded answer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VoiceSearch,
});

function errorMessage(error: unknown): string {
  if (error instanceof MicPermissionError)
    return "Microphone access was blocked. Allow it in your browser settings and try again.";
  if (error instanceof MicUnavailableError)
    return "No microphone found. Connect one and try again.";
  if (error instanceof MicUnsupportedError)
    return "This browser can't record audio. Try Chrome or Safari.";
  const message = error instanceof Error ? error.message : String(error);
  if (!navigator.onLine) return "You appear to be offline. Reconnect and try again.";
  if (/\[429\]/.test(message)) return "Too many requests right now. Wait a moment and try again.";
  if (/\[4\d\d\]/.test(message)) return "The request was rejected. Please try again.";
  return "Something went wrong. Please try again.";
}

function VoiceSearch() {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<VoiceNote | null>(null);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [stats, setStats] = useState<LatencyStats>(emptyStats());

  const recorderRef = useRef<RecorderHandle | null>(null);
  const sessionRef = useRef<TranscriptionSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackerRef = useRef<LatencyTracker | null>(null);

  useEffect(() => {
    listNotes().then(setNotes).catch(() => undefined);
  }, []);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => stopTimer, []);

  const handleHoldStart = useCallback(async () => {
    if (recorderRef.current) return;
    if (!isRecordingSupported()) {
      setState("error");
      setError(errorMessage(new MicUnsupportedError()));
      return;
    }

    setError(null);
    setTranscript("");
    setCurrent(null);
    setState("recording");
    setElapsedMs(0);

    const tracker = new LatencyTracker(setStats);
    trackerRef.current = tracker;
    tracker.start();

    const session = createWindowedGeminiSession({
      latency: tracker,
      onTranscript: setTranscript,
      onError: () => undefined, // dropped windows are recovered by the next one
    });
    sessionRef.current = session;

    try {
      const recorder = await startRecording({
        onFirstAudio: () => tracker.markFirstAudio(),
        onWindow: (window, index) => session.pushWindow(window, index),
      });
      recorderRef.current = recorder;
      const startedAt = performance.now();
      timerRef.current = setInterval(() => setElapsedMs(performance.now() - startedAt), 100);
    } catch (err) {
      session.cancel();
      sessionRef.current = null;
      setState("error");
      setError(errorMessage(err));
    }
  }, []);

  const handleHoldEnd = useCallback(async () => {
    const recorder = recorderRef.current;
    const session = sessionRef.current;
    recorderRef.current = null;
    sessionRef.current = null;
    stopTimer();
    if (!recorder || !session) {
      setState("idle");
      return;
    }

    setState("processing");
    const { blob, durationMs } = recorder.stop();

    let question = "";
    try {
      question = await session.finish();
    } catch {
      question = "";
    }

    if (!question.trim() || durationMs < 400) {
      setState("error");
      setError("I didn't catch that. Hold the button and speak clearly.");
      return;
    }
    setTranscript(question);

    // Exactly one grounded request, for the completed question only.
    const startedAt = performance.now();
    try {
      const result = await answerQuestion({ data: { question } });
      trackerRef.current?.markAnswer(performance.now() - startedAt);

      const note: VoiceNote = {
        id:
          globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        audio: blob,
        durationMs,
        transcript: question,
        answer: result.answer || "No answer came back. Try asking again.",
        sources: result.sources,
        searched: result.searched,
        createdAt: Date.now(),
      };

      setCurrent(note);
      setState("answer");
      await saveNote(note).catch(() => undefined);
      setNotes(await listNotes().catch(() => notes));
    } catch (err) {
      setState("error");
      setError(errorMessage(err));
    }
  }, [notes]);

  const handleDelete = async (id: string) => {
    await deleteNote(id).catch(() => undefined);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setCurrent((prev) => (prev?.id === id ? null : prev));
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-16 pt-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">VoiceSearch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hold the button and ask. Answers come from the live web.
        </p>
      </header>

      <div className="flex flex-col items-center gap-6 py-10">
        <MicButton
          state={state}
          elapsedMs={elapsedMs}
          onHoldStart={() => void handleHoldStart()}
          onHoldEnd={() => void handleHoldEnd()}
        />

        {(state === "recording" || state === "processing") && (
          <p
            aria-live="polite"
            className="min-h-[3.5rem] w-full text-center text-lg leading-snug tracking-tight text-foreground"
          >
            {transcript || <span className="text-muted-foreground">…</span>}
          </p>
        )}

        {state === "error" && error && (
          <div role="alert" className="w-full rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center">
            <p className="text-sm text-foreground">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setState("idle");
              }}
              className="mt-3 h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {state === "answer" && current && <AnswerView note={current} />}

      <div className="mt-6">
        <NoteList
          notes={notes}
          onOpen={(note) => {
            setCurrent(note);
            setTranscript(note.transcript);
            setState("answer");
          }}
          onDelete={(id) => void handleDelete(id)}
        />
      </div>

      {LATENCY_ENABLED && (
        <pre className="mt-8 overflow-x-auto rounded-lg border border-border bg-card p-3 text-[11px] leading-relaxed text-muted-foreground">
{`mic first audio   ${stats.micLatencyMs ?? "-"} ms
first transcript  ${stats.firstTranscriptMs ?? "-"} ms
windows sent      ${stats.windowsSent}  skipped ${stats.windowsSkipped}  failed ${stats.windowsFailed}
window round-trip last ${stats.lastWindowRoundTripMs ?? "-"} ms  avg ${stats.avgWindowRoundTripMs ?? "-"} ms
answer latency    ${stats.answerLatencyMs ?? "-"} ms
total             ${stats.totalMs ?? "-"} ms`}
        </pre>
      )}
    </main>
  );
}
