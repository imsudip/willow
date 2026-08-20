import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2, Share2 } from "lucide-react";
import { useEntry } from "../../lib/hooks";
import { db, deleteAudio, getAudio } from "../../lib/db";
import { TextAnimate } from "../../components/ui/text-animate";
import { AudioPlayer } from "../../components/ui/audio-player";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../components/ui/alert-dialog";

export function EntryDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const entry = useEntry(id);

  const [showRaw, setShowRaw] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!entry?.audioPresent || !entry.id) return;
    let url: string | null = null;
    void getAudio(entry.id).then((blob) => {
      if (blob) {
        url = URL.createObjectURL(blob);
        setAudioUrl(url);
      } else if (entry.serverAudioUrl) {
        url = entry.serverAudioUrl;
        setAudioUrl(url);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry?.id, entry?.audioPresent, entry?.serverAudioUrl]);

  if (!entry) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">Loading…</div>
    );
  }

  const current = entry;
  async function handleDelete() {
    if (!current) return;
    await db.entries.update(current.id, { deleted: true, dirty: true, updatedAt: new Date().toISOString() });
    if (current.audioPresent) await deleteAudio(current.id);
    navigate("/entries");
  }

  async function handleShare() {
    if (!current) return;
    const text = `${current.title || "Journal entry"}\n\n${current.cleanedBody || current.rawTranscript}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            aria-label="Share"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink"
          >
            <Share2 className="h-5 w-5" aria-hidden />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                aria-label="Delete entry"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink"
              >
                <Trash2 className="h-5 w-5" aria-hidden />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the entry and its recording from your journal. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted-foreground)]">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void handleDelete()}
                  className="min-h-11 rounded-xl bg-[var(--destructive)] px-4 text-sm font-medium text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <article className="mt-6">
        <TextAnimate
          as="h1"
          by="word"
          animation="blurIn"
          duration={0.4}
          className="font-serif text-3xl font-normal leading-tight text-balance"
        >
          {current.title || "Untitled"}
        </TextAnimate>
        <p className="mt-1 text-sm text-muted">
          {new Date(entry.recordedAt).toLocaleString(undefined, {
            dateStyle: "full",
            timeStyle: "short",
          })}
        </p>

        {entry.mood && (
          <p className="mt-3 inline-block rounded-full bg-accent-soft px-3 py-1 text-sm capitalize">
            {entry.mood}
          </p>
        )}

        {/* Custom audio player (play/pause, seek, volume — no native controls) */}
        {audioUrl && (
          <div className="mt-4">
            <AudioPlayer src={audioUrl} durationHintMs={entry.audioDurationMs} />
          </div>
        )}

        <div className="mt-5 flex gap-2" role="tablist" aria-label="View">
          {(["cleaned", "raw"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              id={`detail-tab-${t}`}
              aria-selected={(t === "raw") === showRaw}
              aria-controls={`detail-panel-${t}`}
              onClick={() => setShowRaw(t === "raw")}
              className={`rounded-full px-3 py-1.5 text-sm capitalize ${
                (t === "raw") === showRaw ? "bg-accent-soft text-ink" : "text-muted"
              }`}
            >
              {t === "cleaned" ? "Polished" : "Raw"}
            </button>
          ))}
        </div>

        <p id="detail-panel-cleaned" role="tabpanel" aria-labelledby="detail-tab-cleaned" className="journal mt-4 whitespace-pre-wrap">
          {showRaw ? entry.rawTranscript : entry.cleanedBody || entry.rawTranscript}
        </p>

        {entry.tags.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {entry.tags.map((t) => (
              <span key={t} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
                #{t}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
