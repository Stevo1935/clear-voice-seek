// Dev-only latency instrumentation. Hidden in production builds.

export const LATENCY_ENABLED = import.meta.env.DEV;

export interface LatencyStats {
  micLatencyMs: number | null;
  windowsSent: number;
  windowsSkipped: number;
  windowsFailed: number;
  lastWindowRoundTripMs: number | null;
  avgWindowRoundTripMs: number | null;
  firstTranscriptMs: number | null;
  answerLatencyMs: number | null;
  totalMs: number | null;
}

export const emptyStats = (): LatencyStats => ({
  micLatencyMs: null,
  windowsSent: 0,
  windowsSkipped: 0,
  windowsFailed: 0,
  lastWindowRoundTripMs: null,
  avgWindowRoundTripMs: null,
  firstTranscriptMs: null,
  answerLatencyMs: null,
  totalMs: null,
});

export class LatencyTracker {
  private startedAt = 0;
  private roundTrips: number[] = [];
  private stats: LatencyStats = emptyStats();

  constructor(private readonly onChange: (stats: LatencyStats) => void) {}

  private emit() {
    if (LATENCY_ENABLED) this.onChange({ ...this.stats });
  }

  start() {
    this.startedAt = performance.now();
    this.roundTrips = [];
    this.stats = emptyStats();
    this.emit();
  }

  markFirstAudio() {
    this.stats.micLatencyMs = Math.round(performance.now() - this.startedAt);
    this.emit();
  }

  markWindowSent() {
    this.stats.windowsSent += 1;
    this.emit();
  }

  markWindowSkipped() {
    this.stats.windowsSkipped += 1;
    this.emit();
  }

  markWindowFailed() {
    this.stats.windowsFailed += 1;
    this.emit();
  }

  markWindowDone(roundTripMs: number) {
    this.roundTrips.push(roundTripMs);
    this.stats.lastWindowRoundTripMs = Math.round(roundTripMs);
    this.stats.avgWindowRoundTripMs = Math.round(
      this.roundTrips.reduce((a, b) => a + b, 0) / this.roundTrips.length,
    );
    this.emit();
  }

  markFirstTranscript() {
    if (this.stats.firstTranscriptMs == null) {
      this.stats.firstTranscriptMs = Math.round(performance.now() - this.startedAt);
      this.emit();
    }
  }

  markAnswer(answerLatencyMs: number) {
    this.stats.answerLatencyMs = Math.round(answerLatencyMs);
    this.stats.totalMs = Math.round(performance.now() - this.startedAt);
    this.emit();
  }
}
