import type { ApiEntry, Prompt } from "@willow/shared";

/** Thin fetch wrapper for the Willow API (same-origin, session cookies). */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "same-origin",
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

  uploadAudio: (entryId: string, blob: Blob) => {
    const form = new FormData();
    form.append("file", blob, "recording.webm");
    return api<{ ok: boolean }>(`/api/entries/${entryId}/audio`, {
      method: "PUT",
      body: form,
    });
  },

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
