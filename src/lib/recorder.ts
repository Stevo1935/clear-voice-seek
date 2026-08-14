// Microphone capture: raw PCM via Web Audio, downsampled to 16 kHz mono.
// The full recording is kept as one continuous buffer and encoded to a single
// WAV blob at stop(). Rolling windows are transient slices used only for
// transcription and are never stored.

export const TARGET_SAMPLE_RATE = 16000;
export const WINDOW_MS = 800; // new audio per transcription request
export const OVERLAP_MS = 200; // tail of previous window, avoids clipping words
const SILENCE_RMS = 0.006;

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

export function isSilent(samples: Float32Array): boolean {
  return rms(samples) < SILENCE_RMS;
}

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j] ?? 0;
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export class MicUnavailableError extends Error {}
export class MicPermissionError extends Error {}
export class MicUnsupportedError extends Error {}

export interface RecorderHandle {
  stop: () => { blob: Blob; durationMs: number; samples: Float32Array };
  cancel: () => void;
}

export interface StartRecordingOptions {
  /** Called ~every WINDOW_MS with the newest window (plus overlap tail). */
  onWindow: (window: Float32Array, index: number) => void;
  onFirstAudio?: () => void;
}

export function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)
  );
}

export async function startRecording(options: StartRecordingOptions): Promise<RecorderHandle> {
  if (!isRecordingSupported()) {
    throw new MicUnsupportedError("This browser can't record audio.");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError") {
      throw new MicPermissionError("Microphone access was blocked.");
    }
    throw new MicUnavailableError("No microphone is available.");
  }

  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  await ctx.resume().catch(() => undefined);

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const gate = ctx.createGain();
  gate.gain.value = 0; // keep the graph alive without echoing to speakers

  const chunks: Float32Array[] = [];
  let total = 0;
  let gotAudio = false;
  let emitted = 0; // samples already emitted as window audio
  let windowIndex = 0;

  const windowSamples = Math.round((WINDOW_MS / 1000) * TARGET_SAMPLE_RATE);
  const overlapSamples = Math.round((OVERLAP_MS / 1000) * TARGET_SAMPLE_RATE);

  const flat = (from: number, to: number): Float32Array => {
    const out = new Float32Array(Math.max(0, to - from));
    let cursor = 0;
    let base = 0;
    for (const c of chunks) {
      const start = Math.max(from, base);
      const end = Math.min(to, base + c.length);
      if (end > start) {
        out.set(c.subarray(start - base, end - base), cursor);
        cursor += end - start;
      }
      base += c.length;
      if (base >= to) break;
    }
    return out;
  };

  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    const resampled = downsample(new Float32Array(input), ctx.sampleRate, TARGET_SAMPLE_RATE);
    chunks.push(resampled);
    total += resampled.length;
    if (!gotAudio) {
      gotAudio = true;
      options.onFirstAudio?.();
    }
    while (total - emitted >= windowSamples) {
      const end = emitted + windowSamples;
      const start = Math.max(0, emitted - overlapSamples);
      options.onWindow(flat(start, end), windowIndex++);
      emitted = end;
    }
  };

  source.connect(processor);
  processor.connect(gate);
  gate.connect(ctx.destination);

  let stopped = false;
  const teardown = () => {
    if (stopped) return;
    stopped = true;
    processor.onaudioprocess = null;
    try {
      source.disconnect();
      processor.disconnect();
      gate.disconnect();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => undefined);
  };

  return {
    stop() {
      // Emit whatever tail remains as a final short window before teardown.
      if (total > emitted) {
        const start = Math.max(0, emitted - overlapSamples);
        options.onWindow(flat(start, total), windowIndex++);
        emitted = total;
      }
      const samples = flat(0, total);
      teardown();
      return {
        samples,
        blob: encodeWav(samples, TARGET_SAMPLE_RATE),
        durationMs: Math.round((total / TARGET_SAMPLE_RATE) * 1000),
      };
    },
    cancel: teardown,
  };
}
