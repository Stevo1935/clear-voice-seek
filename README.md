# Speak & Seek

Build a mobile-first web application called VoiceSearch.

The core experience is:

Hold button → speak → see live transcription → release → get a fast answer based on current Google Search data.

This is a voice-first research assistant, not a traditional chatbot.

CORE USER EXPERIENCE

The home screen should have one large microphone button.

When the user presses and holds the button:

Request microphone permission.

Start capturing microphone audio.

Start a real-time Gemini Live API session.

Stream the user's speech/audio to Gemini.

Display the transcription continuously as the user speaks.

Show a recording timer.

Show a clear "Listening..." state.

When the user releases the button:

Stop recording.

Finish the transcription.

Treat the resulting transcript as the user's question.

Send the completed question to Gemini using Google Search grounding.

Return a concise answer based on current web information.

Display the answer and relevant grounding sources.

Save the voice recording, transcript, answer, sources, and timestamp locally.

The response should feel fast and immediate.

IMPORTANT ARCHITECTURE

Use:

React

TypeScript

Vite

Tailwind CSS

Supabase Edge Functions for secure server-side API calls

Gemini Live API for real-time audio/transcription

Gemini 2.5 Flash-Lite for the grounded answer

Gemini's built-in Google Search grounding

IndexedDB for local voice-note/history storage

Do NOT implement Google Search by scraping websites.

Do NOT expose the Gemini API key in client-side code.

All Gemini API keys must remain server-side.

GOOGLE SEARCH GROUNDING

Only use Google Search grounding for the completed user question.

Do NOT perform a Google Search request for every partial transcription.

For example:

User says:

"What's the current..."

"What's the current price..."

"What's the current price of Bitcoin?"

The application should NOT perform three searches.

It should wait until the user's utterance is complete and then perform one grounded search request.

Questions requiring current information should use Google Search grounding.

General questions that do not require current information should not unnecessarily trigger web search.

Examples:

"What is React?" → normal answer.

"What are the latest React features?" → Google Search grounding.

"What is the current Bitcoin price?" → Google Search grounding.

"Who won yesterday's Arsenal match?" → Google Search grounding.

MOBILE-FIRST UI

Keep the interface extremely simple.

The main screen should contain:

App name

Short instruction

Large circular microphone button

Hold-to-speak interaction

Live transcript

Recording duration

Recent voice notes

Do not create a complicated dashboard.

The microphone button should be the dominant element on the screen.

RECORDING STATES

Implement these clear states:

IDLE

"Hold to speak"

RECORDING

"Listening..."

LIVE TRANSCRIPTION

Display the words as they are being spoken.

PROCESSING

"Searching the web..."

ANSWER

Display the final answer.

ERROR

Display a simple human-readable error and allow the user to try again.

ANSWER SCREEN

Show:

The user's transcript

Concise AI answer

Relevant sources

Original voice recording playback

Timestamp

The answer should prioritize useful information over long explanations.

VOICE NOTE HISTORY

Store each completed interaction locally using IndexedDB.

Each note should contain:

unique ID

audio recording

transcript

answer

sources

timestamp

Allow the user to:

replay the recording

open the answer

delete the note

Do not require authentication for V1.

PERFORMANCE

The application should feel extremely responsive.

Avoid unnecessary animations, libraries, API requests, and state updates.

Do not send partial transcripts to the search endpoint.

Do not search until the user's question is complete.

SECURITY

Never expose:

Gemini API keys

Supabase service-role keys

private credentials

in browser/client code.

Use Supabase Edge Functions or another server-side endpoint for Gemini API requests.

ERROR HANDLING

Handle:

microphone permission denied

microphone unavailable

Gemini connection failure

Gemini API failure

search grounding failure

network failure

empty transcription

browser incompatibility

The application should fail gracefully and allow the user to retry.

DESIGN

Use a clean, modern, minimal interface.

Mobile-first.

Large touch targets.

No unnecessary cards or dashboard elements.

The experience should feel closer to a voice search tool than a traditional chat application.

Use accessible contrast and clear typography.

Do not add features that are not requested.

DEVELOPMENT APPROACH

Before implementing each major feature, explain the intended architecture briefly.

Build the application in logical stages:

UI and mobile layout

Hold-to-talk microphone interaction

Real-time Gemini Live transcription

Voice recording persistence

Completed-question Gemini processing

Google Search grounding

Answer/source display

Local history

Error handling and polish

Do not replace the requested Gemini Live API architecture with browser-only speech recognition unless the Gemini Live implementation is technically impossible.

At the end, provide a clear list of:

files created

files modified

environment variables required

Supabase configuration required

Gemini configuration required

how to run the application locally

known limitations

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/69b162a2-92d4-46d1-81e5-fb94f6562c21).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
