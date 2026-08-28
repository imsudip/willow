import type { ApiEntry, Prompt } from "@willow/shared";

// The API lives on Neon Functions; the frontend on Vercel. In dev, Vite
// proxies /api to :8777 (same-origin). In prod, prefix with the deployed
// function origin via VITE_API_ORIGIN.
const apiOrigin = import.meta.env.VITE_API_ORIGIN as string | undefined;

/** Thin fetch wrapper for the Willow API (session cookies). */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiOrigin ?? ""}${path}`, {
    credentials: "include",
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (body as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export const client = {
  getPrompts: () => api<{ questions: Prompt[] }>("/api/prompts/daily"),

  transcribe: async (blob: Blob) => {
    const form = new FormData();
    form.append("file", blob, "recording.webm");
    return api<{ transcript: string }>("/api/transcribe", {
      method: "POST",
      body: form,
    });
  },

  cleanup: (transcript: string) =>
    api<{ title: string; body: string; mood: string | null; tags: string[] }>(
      "/api/transcribe/cleanup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      },
    ),

  syncPush: (entries: Omit<ApiEntry, "dirty">[]) =>
    api<{ accepted: string[] }>("/api/entries/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    }),

  syncPull: (since?: string) =>
    api<{ entries: ApiEntry[] }>(
      `/api/entries/sync?since=${encodeURIComponent(since ?? "")}`,
    ),

  // Upload audio: mint a presigned R2 PUT URL from the API, then upload
  // straight to R2 (never through the API function).
  uploadAudio: async (entryId: string, blob: Blob) => {
    const { uploadUrl } = await api<{ uploadUrl: string }>(
      `/api/entries/${entryId}/audio-url`,
      { method: "POST" },
    );
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "audio/webm" },
      body: blob,
    });
    if (!res.ok) throw new Error(`Upload failed (${res.status})`);
    return { ok: true };
  },

  // Mint a short-lived presigned GET URL for playback.
  getAudioUrl: (entryId: string) =>
    api<{ url: string }>(`/api/entries/${entryId}/audio`),

  weeklyDigest: () =>
    api<{ digest: { summary: string; themes: string[]; reflectionPrompt: string | null } | null; entryCount: number }>(
      "/api/digest/weekly",
    ),

  subscribePush: (subscription: PushSubscription) =>
    api<{ ok: boolean }>("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    }),

  unsubscribePush: (endpoint: string) =>
    api<{ ok: boolean }>("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    }),
};
