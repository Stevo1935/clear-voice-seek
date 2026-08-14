# VoiceSearch — voice-first research assistant

Hold the mic, speak, watch the live transcript, release, get a fast answer grounded in current Google Search results.

## Screens

Single mobile-first screen at `/`:

- App name + one-line instruction
- One large circular microphone button (dominant element, hold-to-speak)
- Live transcript area + recording timer, state label (Hold to speak / Listening… / Searching the web… / error)
- Answer block: transcript, concise answer, source links, audio playback, timestamp
- Recent voice notes list below: replay, open, delete

No dashboard, no auth, no extra pages.

## Interaction flow

1. Press and hold → request mic permission → start capture.
2. Audio is captured as PCM via Web Audio and encoded to WAV (works on iOS Safari too). Short rolling windows are transcribed continuously so words appear while the user is still speaking.
3. Release → the final partial window is transcribed → assembled transcript becomes the question.
4. Exactly one grounded request is sent, with the completed question only — never for partial transcripts.
5. Answer + sources render; the note (single full audio blob, transcript, answer, sources, timestamp) is saved to IndexedDB.

## Windowed transcription design (V1)

V1 is **near-live windowed transcription**, not the Gemini Live API. The pipeline is: microphone → short audio window → server function → Gemini transcription → transcript update.

- **Window duration:** 800 ms of new audio per request (inside the requested 500–1000 ms range), so the transcript updates roughly once per second while speaking.
- **Overlap:** each request sends the 800 ms of new audio plus a 200 ms tail of the previous window, purely to avoid clipping a word at the boundary. No full-recording resends, so audio is not reprocessed repeatedly.
- **Request frequency:** ~1 transcription request per second of speech, one final short request on release. Silence windows (below an RMS threshold) are skipped entirely, and failed windows are dropped rather than retried — a lost window is recovered by the next one.
- **Duplicate removal:** the overlap can repeat a word, so each new window's text is merged into the accumulated transcript by longest-suffix/prefix overlap match (compare on normalized lowercase tokens); if there is no overlap the text is appended with a space.
- **Final transcript:** the accumulated merged text plus the release-window result. Word count and window sequence numbers keep results in order even if responses arrive out of order.

## Audio persistence

The complete recording is kept as one continuous PCM buffer and encoded once, at release, into a single WAV Blob stored in IndexedDB. Rolling windows are transient slices used only for transcription and are never stored.

## Search grounding behaviour

The server call to Gemini 2.5 Flash-Lite enables the built-in `google_search` tool and instructs the model to answer concisely, using search only when the question depends on current information. "What is React?" answers directly; "latest React features", "current Bitcoin price", "yesterday's Arsenal result" trigger grounding. Sources come from the response's grounding metadata (title + URI). No scraping. Exactly one grounded request per completed question.

## Technical section

Stack note: this project runs on TanStack Start (React + TypeScript + Vite + Tailwind). Secure server code is written as TanStack **server functions**. No Supabase, no Lovable Cloud, no auth, no database, no analytics, no third-party voice libraries.

Replaceable transcription abstraction: the UI and IndexedDB talk only to a `TranscriptionSession` interface (`start()`, `pushAudio()`, `onTranscript()`, `stop()` returning the final transcript). V1 ships a `WindowedGeminiTranscription` implementation behind it; a future server-side WebSocket relay to the Gemini Live API can be dropped in as a second implementation with no UI or storage changes.


Files to create:

- `src/routes/index.tsx` — replaces the placeholder; the whole VoiceSearch screen + `head()` metadata
- `src/components/MicButton.tsx` — hold-to-speak button, states, timer
- `src/components/AnswerView.tsx` — transcript, answer, sources, audio player, timestamp
- `src/components/NoteList.tsx` — recent notes: replay / open / delete
- `src/lib/recorder.ts` — Web Audio PCM capture + WAV encoding, rolling windows
- `src/lib/db.ts` — IndexedDB store (id, audio Blob, transcript, answer, sources, createdAt)
- `src/lib/voice.functions.ts` — server functions: `transcribeChunk` and `answerQuestion`
- `src/lib/gemini.server.ts` — Gemini REST helpers (transcription + `generateContent` with `google_search` tool), reads `GEMINI_API_KEY` inside handlers

Files to modify:

- `src/styles.css` — minimal high-contrast voice-tool palette and type scale (semantic tokens only)

Environment: `GEMINI_API_KEY` stored as a project secret (I'll open the secure form). Nothing else; no Supabase config required.

## Error handling

Distinct, human-readable messages with retry for: permission denied, no microphone, unsupported browser (no `getUserMedia`/AudioContext), empty/silent recording, transcription failure, model/grounding failure, network offline, rate limit or quota errors from Gemini.

## Build order

1. UI shell and mobile layout
2. Hold-to-talk capture + timer + states
3. Streaming transcription wiring
4. Recording persistence
5. Grounded answer + sources
6. IndexedDB history
7. Error handling and polish

## Known limitations

- Live transcription is windowed, not a true Gemini Live socket session (key security).
- Desktop hold-to-speak uses pointer events; both mouse and touch supported.
- History is per-device and cleared if the browser wipes storage.
