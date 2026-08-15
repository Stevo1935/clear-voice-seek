// Server-only Gemini REST helpers. The API key is read by the callers
// (server function handlers) and passed in; it never reaches the client.

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-3.5-flash-lite";

export interface GroundingSource {
  title: string;
  uri: string;
}

async function callGemini(model: string, apiKey: string, body: unknown) {
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Gemini request failed [${res.status}]: ${text}`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as GeminiResponse;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      webSearchQueries?: string[];
    };
  }>;
}

const textOf = (json: GeminiResponse) =>
  (json.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();

/** Transcribe one short audio window (base64 WAV). Returns raw text. */
export async function transcribeAudio(apiKey: string, base64Wav: string): Promise<string> {
  const json = await callGemini(MODEL, apiKey, {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Transcribe the speech in this audio clip verbatim. " +
              "Return only the transcribed words with no punctuation-only output, " +
              "no commentary, no quotes. If there is no intelligible speech, return an empty string.",
          },
          { inlineData: { mimeType: "audio/wav", data: base64Wav } },
        ],
      },
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 256 },
  });
  const text = textOf(json);
  return /^(\[|\(|no speech|inaudible|silence)/i.test(text) ? "" : text;
}

const ANSWER_SYSTEM_INSTRUCTION = {
  parts: [
    {
      text:
        "You are a voice search assistant. Answer in at most 3 short sentences, " +
        "leading with the most useful fact. No preamble, no markdown headings, no bullet lists " +
        "unless listing items is the answer. Use Google Search only when the question depends on " +
        "current, recent, live, or local information; answer general knowledge questions directly.",
    },
  ],
};

/** One grounded answer for one completed question. */
export async function answerWithSearch(
  apiKey: string,
  question: string,
): Promise<{
  answer: string;
  sources: GroundingSource[];
  searched: boolean;
}> {
  let json: GeminiResponse;
  try {
    json = await callGemini(MODEL, apiKey, {
      contents: [{ role: "user", parts: [{ text: question }] }],
      tools: [{ google_search: {} }],
      systemInstruction: ANSWER_SYSTEM_INSTRUCTION,
      generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
    });
  } catch (error) {
    // Google Search grounding requires quota/billing the API key may not have.
    // Never silently answer without the web — surface it to the user instead.
    const status = (error as { status?: number }).status;
    if (status === 429 || status === 403 || status === 404) {
      throw new Error("GROUNDING_UNAVAILABLE");
    }
    throw error;
  }


  const meta = json.candidates?.[0]?.groundingMetadata;
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of meta?.groundingChunks ?? []) {
    const uri = chunk.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ uri, title: chunk.web?.title || new URL(uri).hostname });
  }

  return {
    answer: textOf(json),
    sources,
    searched: (meta?.webSearchQueries?.length ?? 0) > 0 || sources.length > 0,

  };
}
