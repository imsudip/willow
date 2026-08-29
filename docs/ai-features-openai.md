# Wiki — AI Features (OpenAI)

> Part of the [Willow docs](../README.md#documentation). See also
> [Architecture](../ARCHITECTURE.md) for the big-picture flow.

## What this is

**OpenAI** powers the AI features. Everything is **server-side only** — the API
key never ships to the client; the server proxies every model call.

| Feature | Model (default) | When |
|---|---|---|
| Transcription | `gpt-4o-mini-transcribe` (batch) | turns an audio recording into text |
| Cleanup | `gpt-4o-mini` | cleans/structures the raw transcript into a journal entry |
| Daily prompts | `gpt-4o-mini` | per-user, per-day cached prompt questions |
| Weekly digest | `gpt-4o-mini` | "week in review" push |

## Configuration

All values live in the **single root `.env.local`** (template:
[`.env.example`](../.env.example)).

| Var | Required | Notes |
|---|---|---|
| `OPENAI_API_KEY` | optional | App-level default key. If unset, users must bring their own (below) for AI features |
| `TRANSCRIPTION_MODEL` | no | Default `gpt-4o-mini-transcribe` |
| `CLEANUP_MODEL` | no | Default `gpt-4o-mini` |

Get a key at https://platform.openai.com/api-keys.

### Bring-your-own-key (BYOK)

Each user can set their own OpenAI key from **Settings → OpenAI key**. It's
stored **encrypted at rest** in `user_config.openai_api_key_enc` (AES-256-GCM,
key derived from `USER_CONFIG_SECRET` → `AUTH_SECRET`) and never returned to the
client. On every AI request the server resolves **user key > app key**
(`apps/web/src/lib/user-config.ts`). This lets you self-host Willow without
giving users access to your billing account — they pay for their own usage.

## Cost

OpenAI is the **only variable cost** in Willow — everything else is on free
tiers with hard gates.

- **Transcription:** ~$0.006/min for `gpt-4o-mini-transcribe` → a 5-min daily
  ramble ≈ **$0.90/mo** before other AI calls.
- **Cleanup + prompts + digest:** pennies (small token calls, prompts cached
  daily per user).
- With BYOK, per-user usage is billed to the **user's** OpenAI account, not
  yours.

## Managing / troubleshooting

- **Transcription fails / no transcript** — confirm a key is available (app
  `OPENAI_API_KEY` or the user's BYO key in Settings) and has access to
  `gpt-4o-mini-transcribe` / `gpt-4o-mini`; check function logs for the OpenAI
  error.
- **User set a key but AI still errors** — the key may be invalid, or
  `AUTH_SECRET`/`USER_CONFIG_SECRET` was rotated (stored keys become
  undecryptable → treated as unset). Re-enter the key in Settings.
- **Prompts look stale** — prompts are cached per `(user, date)`; they refresh
  daily.
- **Budget control** — audio is uploaded to R2 for storage via presigned URLs
  (never proxied through the API for storage), and transcription runs on the
  compact audio you record. Set a spend limit in the OpenAI dashboard as a
  backstop.
