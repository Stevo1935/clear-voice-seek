import { useEffect, useState } from "react";
import type { VoiceNote } from "@/lib/db";

const timeLabel = (ts: number) =>
  new Date(ts).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });

export function AnswerView({ note }: { note: VoiceNote }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(note.audio);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [note.audio]);

  return (
    <section className="w-full space-y-5 border-t border-border pt-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">You asked</p>
        <p className="mt-1 text-lg font-medium leading-snug text-foreground">{note.transcript}</p>
      </div>

      <p className="whitespace-pre-wrap text-[1.35rem] font-semibold leading-snug tracking-tight text-foreground">
        {note.answer}
      </p>

      {note.sources.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Sources</p>
          <ul className="mt-2 space-y-1.5">
            {note.sources.slice(0, 6).map((s) => (
              <li key={s.uri}>
                <a
                  href={s.uri}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block truncate text-sm text-primary underline underline-offset-4"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {url && <audio controls src={url} className="h-10 min-w-0 flex-1" />}
        <time className="text-xs text-muted-foreground">{timeLabel(note.createdAt)}</time>
      </div>
    </section>
  );
}
