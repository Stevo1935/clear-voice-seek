// Transcription abstraction.
//
// The UI and IndexedDB layers only ever talk to `TranscriptionSession`.
// V1 ships `createWindowedGeminiSession` (microphone -> short audio window ->
// server function -> Gemini transcription -> transcript update). A future
// server-side WebSocket relay to the Gemini Live API can implement the same
// interface without touching UI or storage code.

export interface TranscriptionSession {
  /** Push one window of 16 kHz mono PCM for transcription. */
  pushWindow: (window: Float32Array, index: number) => void;
  /** Flush in-flight windows and resolve the assembled transcript. */
  finish: () => Promise<string>;
  /** Abandon the session; no further callbacks fire. */
  cancel: () => void;
}

export interface TranscriptionSessionOptions {
  onTranscript: (text: string) => void;
  onError?: (error: unknown) => void;
}

export type TranscriptionSessionFactory = (
  options: TranscriptionSessionOptions,
) => TranscriptionSession;

const normalize = (token: string) => token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Merge a new window's text into the accumulated transcript.
 * Windows carry a 200 ms overlap tail, so the first few tokens can repeat.
 * We find the longest suffix of `acc` that matches a prefix of `next`
 * (compared on normalized lowercase tokens) and drop the duplicate part.
 */
export function mergeTranscript(acc: string, next: string): string {
  const a = acc.trim();
  const b = next.trim();
  if (!b) return a;
  if (!a) return b;

  const at = a.split(/\s+/);
  const bt = b.split(/\s+/);
  const max = Math.min(at.length, bt.length, 12);

  for (let n = max; n > 0; n--) {
    let match = true;
    for (let i = 0; i < n; i++) {
      if (normalize(at[at.length - n + i] ?? "") !== normalize(bt[i] ?? "")) {
        match = false;
        break;
      }
    }
    if (match) return [...at, ...bt.slice(n)].join(" ");
  }
  return `${a} ${b}`;
}
