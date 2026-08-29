import { FALLBACK_TRANSCRIPTION_MODEL } from "@willow/shared";
import { env } from "../env";

/**
 * Transcribes an uploaded audio file using the Wispr Flow (batch) file API.
 * The audio blob comes from the client; the OpenAI key stays server-side.
 */
export async function transcribeAudioFile(blob: File): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "recording.webm");
  form.append("model", FALLBACK_TRANSCRIPTION_MODEL);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Transcription failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { text?: string };
  return data.text ?? "";
}
