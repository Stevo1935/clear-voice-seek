import { useRef } from "react";
import type { VoiceNote } from "@/lib/db";

interface NoteListProps {
  notes: VoiceNote[];
  onOpen: (note: VoiceNote) => void;
  onDelete: (id: string) => void;
}

export function NoteList({ notes, onOpen, onDelete }: NoteListProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  if (notes.length === 0) return null;

  const play = (note: VoiceNote) => {
    audioRef.current?.pause();
    const url = URL.createObjectURL(note.audio);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audioRef.current = audio;
    void audio.play();
  };

  return (
    <section className="w-full border-t border-border pt-6">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Recent</h2>
      <ul className="mt-3 divide-y divide-border">
        {notes.map((note) => (
          <li key={note.id} className="flex items-center gap-2 py-3">
            <button
              type="button"
              onClick={() => play(note)}
              aria-label="Replay recording"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-foreground active:bg-accent"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onOpen(note)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-sm font-medium text-foreground">
                {note.transcript}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{note.answer}</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              aria-label="Delete note"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                <path d="M4 7h16M9.5 7V4.8h5V7M6.5 7l.8 12.2h9.4L17.5 7" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
