import { encodeWav, isSilent, TARGET_SAMPLE_RATE } from "./recorder";
import { mergeTranscript, type TranscriptionSession, type TranscriptionSessionOptions } from "./transcription";
import type { LatencyTracker } from "./latency";
import { transcribeWindow } from "./voice.functions";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

/**
 * V1 transcription: microphone -> 800 ms window (+200 ms overlap tail)
 * -> server function -> Gemini -> transcript update.
 * Silent windows are skipped; failed windows are dropped, not retried.
 */
export function createWindowedGeminiSession(
  options: TranscriptionSessionOptions & { latency?: LatencyTracker },
): TranscriptionSession {
  let cancelled = false;
  let transcript = "";
  const pending = new Map<number, Promise<void>>();
  const results = new Map<number, string>();
  let applied = 0; // next index to fold into the transcript

  const applyReady = () => {
    let changed = false;
    while (results.has(applied)) {
      const text = results.get(applied) ?? "";
      results.delete(applied);
      applied += 1;
      if (text) {
        transcript = mergeTranscript(transcript, text);
        changed = true;
      }
    }
    if (changed && !cancelled) {
      options.latency?.markFirstTranscript();
      options.onTranscript(transcript);
    }
  };

  const pushWindow = (window: Float32Array, index: number) => {
    if (cancelled) return;
    if (isSilent(window)) {
      options.latency?.markWindowSkipped();
      results.set(index, "");
      applyReady();
      return;
    }

    const started = performance.now();
    options.latency?.markWindowSent();

    const task = (async () => {
      try {
        const blob = encodeWav(window, TARGET_SAMPLE_RATE);
        const audio = toBase64(new Uint8Array(await blob.arrayBuffer()));
        const res = await transcribeWindow({ data: { audio, index } });
        options.latency?.markWindowDone(performance.now() - started);
        results.set(index, res.text ?? "");
      } catch (error) {
        options.latency?.markWindowFailed();
        results.set(index, "");
        if (!cancelled) options.onError?.(error);
      } finally {
        pending.delete(index);
        applyReady();
      }
    })();

    pending.set(index, task);
  };

  return {
    pushWindow,
    async finish() {
      await Promise.allSettled([...pending.values()]);
      applyReady();
      return transcript.trim();
    },
    cancel() {
      cancelled = true;
      pending.clear();
      results.clear();
    },
  };
}
