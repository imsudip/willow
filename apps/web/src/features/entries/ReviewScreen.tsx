import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Eraser, RotateCcw, Trash2 } from "lucide-react";
import { MOODS, type Entry, type Mood } from "@willow/shared";
import { useEntry } from "../../lib/hooks";
import { db, deleteAudio, getAudio } from "../../lib/db";
import { client } from "../../lib/api";
import { Checkbox } from "../../components/ui/checkbox";

export function ReviewScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const entry = useEntry(id);

  const [tab, setTab] = useState<"cleaned" | "raw">("cleaned");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<Mood | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [keepAudio, setKeepAudio] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate local editor state when the entry loads/changes
  useEffect(() => {
    if (!entry) return;
    setTitle(entry.title ?? "");
    setBody(entry.cleanedBody || entry.rawTranscript);
    setMood(entry.mood);
    setTags(entry.tags ?? []);
    setKeepAudio(entry.audioPresent);
  }, [entry?.id, entry?.title, entry?.cleanedBody, entry?.mood, entry?.tags, entry?.audioPresent]);

  const audioPresent = entry?.audioPresent ?? false;

  async function save() {
    if (!entry) return;
    setSaving(true);
    setError(null);
    try {
      await db.entries.update(entry.id, {
        title: title.trim() || "Untitled",
        cleanedBody: body.trim(),
        mood,
        tags,
        status: "ready",
        dirty: true,
        updatedAt: new Date().toISOString(),
      });

      if (!keepAudio && audioPresent) {
        await deleteAudio(entry.id);
        await db.entries.update(entry.id, { audioPresent: false, dirty: true });
      }

      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!entry) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <h1 className="font-serif text-2xl font-normal text-balance">Your entry</h1>
      </div>

      {/* Toggle cleaned / raw */}
      <div className="mt-5 flex rounded-full border border-line bg-surface p-1" role="tablist" aria-label="View">
        {(["cleaned", "raw"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            id={`review-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`review-panel-${t}`}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? "bg-accent-soft text-ink" : "text-muted"
            }`}
          >
            {t === "cleaned" ? "Polished" : "Raw ramble"}
          </button>
        ))}
      </div>

      {tab === "cleaned" ? (
        <div id="review-panel-cleaned" role="tabpanel" aria-labelledby="review-tab-cleaned" className="mt-6 space-y-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give it a title"
            className="w-full border-b border-line bg-transparent pb-2 font-serif text-2xl font-medium text-ink placeholder:text-muted focus:border-accent-strong focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="journal w-full resize-none bg-transparent text-ink placeholder:text-muted focus:outline-none"
            placeholder="Your words will appear here…"
          />

          {/* Mood */}
          <div>
            <p className="text-sm font-medium text-muted">How did it feel?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(mood === m ? null : m)}
                  className={`rounded-full border px-3 py-1.5 text-sm capitalize transition-colors ${
                    mood === m
                      ? "border-accent-strong bg-accent-soft text-ink"
                      : "border-line text-muted"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="text-sm font-medium text-muted">Tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  className="rounded-full bg-accent-soft px-3 py-1.5 text-sm text-ink"
                >
                  {t} ×
                </button>
              ))}
              {tags.length === 0 && <p className="text-sm text-muted">No tags yet.</p>}
            </div>
          </div>
        </div>
      ) : (
        <div id="review-panel-raw" role="tabpanel" aria-labelledby="review-tab-raw" className="mt-6">
          <p className="journal whitespace-pre-wrap text-ink/80">
            {entry.rawTranscript || "No transcript yet."}
          </p>
        </div>
      )}

      {/* Audio keep toggle */}
      {audioPresent && (
        <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <Checkbox
            checked={keepAudio}
            onCheckedChange={(v) => setKeepAudio(v === true)}
            className="mt-1"
            aria-label="Keep the recording too"
          />
          <span>
            <span className="block text-sm font-medium text-ink">Keep the recording too</span>
            <span className="block text-xs text-muted">
              You'll be able to play back the original voice note later. Turn this off to save
              only the text.
            </span>
          </span>
        </label>
      )}

      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="tabbar fixed inset-x-0 bottom-0 z-40 border-t border-line bg-canvas/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-3">
          <button
            onClick={() => navigate("/", { replace: true })}
            className="flex-1 rounded-xl border border-line py-3 text-sm font-medium text-muted"
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-accent-strong py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? <RotateCcw className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
            Save entry
          </button>
        </div>
      </div>
    </div>
  );
}
