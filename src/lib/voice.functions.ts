import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const WindowInput = z.object({
  audio: z.string().min(1), // base64 WAV, short window only
  index: z.number().int().nonnegative(),
});

const QuestionInput = z.object({
  question: z.string().min(1).max(2000),
});

/** Transcribe one rolling audio window. Called ~once per second while speaking. */
export const transcribeWindow = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => WindowInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Transcription is not configured.");
    const { transcribeAudio } = await import("./gemini.server");
    const text = await transcribeAudio(apiKey, data.audio);
    return { index: data.index, text };
  });

/** Exactly one grounded request, only for a completed question. */
export const answerQuestion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => QuestionInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("Search is not configured.");
    const { answerWithSearch } = await import("./gemini.server");
    return answerWithSearch(apiKey, data.question);
  });
