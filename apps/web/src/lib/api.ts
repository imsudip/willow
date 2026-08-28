import type { ApiEntry, Prompt } from "@willow/shared";

// All API requests are same-origin: in prod the Vercel /api rewrite forwards
// to the Neon function; in dev the Vite proxy forwards to :8777. Cookies flow
// naturally and no cross-origin CORS is involved.
/** Thin fetch wrapper for the Willow API (session cookies). */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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

  // Upload audio: mint a presigned R2 PUT URL from the API (declaring the
  // exact blob size, which the server validates and signs), upload straight
  // to R2 (never through the API function), then confirm completion so the
  // entry is marked as having audio. On any failure after minting, release
  // the reserved quota slot so retries don't burn the daily cap.
  uploadAudio: async (entryId: string, blob: Blob) => {
    const { uploadUrl } = await api<{ uploadUrl: string }>(
      `/api/entries/${entryId}/audio-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: blob.size }),
      },
    );
    try {
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/webm" },
        body: blob,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      return await api<{ ok: boolean }>(`/api/entries/${entryId}/audio-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size: blob.size }),
      });
    } catch (err) {
      // The PUT or completion failed; give the quota slot back so the next
      // sync attempt can mint again without consuming the daily cap.
      await api<{ ok: boolean }>(`/api/entries/${entryId}/audio-release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => null);
      throw err;
    }
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
