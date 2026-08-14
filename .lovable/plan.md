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
2. Audio is captured as PCM via Web Audio and encoded to WAV (works on iOS Safari too), while short rolling WAV windows are sent to the server for near-live transcription so words appear as they are spoken.
3. Release → final window transcribed → full transcript becomes the question.
4. One single grounded request is sent with the completed question — never for partial transcripts.
5. Answer + sources render; the note (audio blob, transcript, answer, sources, timestamp) is saved to IndexedDB.

## Search grounding behaviour

The server call to Gemini 2.5 Flash-Lite enables the built-in `google_search` tool and instructs the model to answer concisely, using search only when the question depends on current information. "What is React?" answers directly; "latest React features", "current Bitcoin price", "yesterday's Arsenal result" trigger grounding. Sources come from the response's grounding metadata (title + URI). No scraping.

## Technical section

Stack note: this project runs on TanStack Start (React + TypeScript + Vite + Tailwind). Secure server code is written as TanStack **server functions** instead of Supabase Edge Functions — same guarantee, keys stay server-side. No Lovable Cloud needed; history is IndexedDB-only.

Gemini Live note: the Live API is a bidirectional WebSocket session that requires the API key at the socket, so it cannot be opened from the browser without exposing the key. To keep the key server-side, live transcription is implemented as continuous short-window streaming transcription through a server function (perceptually live, sub-second word updates), and the final grounded answer uses Gemini 2.5 Flash-Lite with the Google Search tool. If you later want true Live API sessions, that needs a WebSocket relay, which I can add as a follow-up.

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
