# Wiki — AI Features (OpenAI)

> Part of the [Willow docs](../README.md#documentation). See also
> [Architecture](../ARCHITECTURE.md) for the big-picture flow.

## What this is

**OpenAI** powers the AI features. Everything is **server-side only** — the API
key never ships to the client; the API proxies every model call.

| Feature | Model (default) | When |
|---|---|---|
| Transcription | `gpt-live-transcribe` | turns an audio recording into text |
| Cleanup | `gpt-4o-mini` | cleans/structures the raw transcript into a journal entry |
| Daily prompts | `gpt-4o-mini` | per-user, per-day cached prompt questions |
| Weekly digest | `gpt-4o-mini` | "week in review" push |

## Configuration

All values live in the **single root `.env.local`** (template:
[`.env.example`](../.env.example)).

| Var | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | yes (all AI features) | Required for transcription, cleanup, prompts, and digest. Server-side only; never shipped to the client |
| `TRANSCRIPTION_MODEL` | no | Default `gpt-live-transcribe` |
| `CLEANUP_MODEL` | no | Default `gpt-4o-mini` |

Get a key at https://platform.openai.com/api-keys.

## Cost

OpenAI is the **only variable cost** in Willow — everything else is on free
tiers with hard gates.

- **Transcription:** ~$0.017/min for `gpt-live-transcribe` → a 5-min daily
  ramble ≈ **$2.55/mo** before other AI calls.
- **Cleanup + prompts + digest:** pennies (small token calls, prompts cached
  daily per user).

## Managing / troubleshooting

- **Transcription fails / no transcript** — confirm the key has access to
  `gpt-live-transcribe` and `gpt-4o-mini`, and check function logs for the
  OpenAI error.
- **Prompts look stale** — prompts are cached per `(user, date)`; they refresh
  daily.
- **Budget control** — audio is uploaded to R2 for storage via presigned URLs
  (never proxied through the API for storage), and transcription runs on the
  compact audio you record. Set a spend limit in the OpenAI dashboard as a
  backstop.
