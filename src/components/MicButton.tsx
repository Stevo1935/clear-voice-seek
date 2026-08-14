import type { PointerEvent as ReactPointerEvent } from "react";

export type VoiceState = "idle" | "recording" | "processing" | "answer" | "error";

interface MicButtonProps {
  state: VoiceState;
  elapsedMs: number;
  onHoldStart: () => void;
  onHoldEnd: () => void;
}

const format = (ms: number) => {
  const total = Math.floor(ms / 100) / 10;
  return `${total.toFixed(1)}s`;
};

export function MicButton({ state, elapsedMs, onHoldStart, onHoldEnd }: MicButtonProps) {
  const recording = state === "recording";
  const busy = state === "processing";

  const start = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (busy) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onHoldStart();
  };
  const end = () => {
    if (recording) onHoldEnd();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        aria-label="Hold to speak"
        aria-pressed={recording}
        disabled={busy}
        onPointerDown={start}
        onPointerUp={end}
        onPointerCancel={end}
        onContextMenu={(e) => e.preventDefault()}
        className={[
          "relative flex h-44 w-44 select-none touch-none items-center justify-center rounded-full",
          "border-4 outline-none transition-[transform,background-color] duration-150",
          "focus-visible:ring-4 focus-visible:ring-ring disabled:opacity-60",
          recording
            ? "scale-105 border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground active:scale-95",
        ].join(" ")}
        style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
      >
        {recording && (
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" aria-hidden />
        )}
        <svg viewBox="0 0 24 24" className="relative h-16 w-16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
          <rect x="9" y="2.5" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3.5" />
        </svg>
      </button>

      <p aria-live="polite" className="h-6 text-base font-medium tracking-tight text-muted-foreground">
        {recording ? (
          <span className="text-primary">Listening… {format(elapsedMs)}</span>
        ) : busy ? (
          "Searching the web…"
        ) : (
          "Hold to speak"
        )}
      </p>
    </div>
  );
}
