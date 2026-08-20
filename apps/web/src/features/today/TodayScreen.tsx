import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mic } from "lucide-react";
import type { Prompt } from "@willow/shared";
import { client } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useTodayEntries } from "../../lib/hooks";
import { ShimmerButton } from "../../components/ui/shimmer-button";
import { TextAnimate } from "../../components/ui/text-animate";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function TodayScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const todayEntries = useTodayEntries();
  const [questions, setQuestions] = useState<Prompt[] | null>(null);
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!offline) {
      client
        .getPrompts()
        .then((r) => setQuestions(r.questions))
        .catch(() => setQuestions(null));
    }
  }, [offline]);

  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="fade-up space-y-8">
      {offline && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm text-warning">
          Offline — entries will sync when you're back online.
        </div>
      )}

      <header className="pt-2">
        <p className="text-sm text-muted">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <TextAnimate
          as="h1"
          by="word"
          animation="blurInUp"
          duration={0.5}
          className="mt-1 font-serif text-4xl font-normal leading-tight text-balance"
        >
          {`${greeting()}${firstName ? `, ${firstName}` : ""}`}
        </TextAnimate>
      </header>

      {todayEntries.length > 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Today's entries{todayEntries.length > 1 ? ` (${todayEntries.length})` : ""}
          </p>
          <ul className="mt-2 space-y-2">
            {todayEntries.slice(0, 3).map((e) => (
              <li key={e.id}>
                <Link to={`/entries/${e.id}`} className="block rounded-xl border border-line/60 p-3 transition-colors active:bg-surface-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="truncate font-serif text-lg font-medium">{e.title || "Untitled"}</h2>
                    {e.mood && <span className="shrink-0 text-xs capitalize text-muted">{e.mood}</span>}
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted">{e.cleanedBody || e.rawTranscript}</p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(e.recordedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/entries" className="mt-3 inline-block text-sm font-medium text-accent-strong">
            See all entries →
          </Link>
        </section>
      ) : (
        <section>
          <p className="font-serif text-[11px] font-medium uppercase tracking-[0.14em] text-muted">A place to start</p>
          {questions ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface divide-y divide-line/60">
              {questions.map((q, i) => (
                <div key={i} className={i === 0 ? "bg-accent-soft/40 p-4" : "p-4"}>
                  <p className={i === 0 ? "font-serif text-[1.1875rem] leading-snug" : "font-serif text-[1.0625rem] leading-snug text-ink/90"}>{q.question}</p>
                  {q.sourceHint && <p className="mt-1 text-xs text-muted">{q.sourceHint}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col items-center gap-2 pb-2">
        <ShimmerButton
          onClick={() => navigate("/record")}
          aria-label="Start recording"
          shimmerColor="#ffffff"
          shimmerSize="0.08em"
          background="var(--color-accent-strong)"
          className="h-24 w-24 rounded-full p-0 shadow-lg shadow-accent/30"
        >
          <Mic className="h-10 w-10" strokeWidth={1.8} aria-hidden />
        </ShimmerButton>
        <p className="text-sm font-medium text-ink">Tap to ramble</p>
        <p className="text-xs text-muted">It's just for you. No one's grading.</p>
      </div>
    </div>
  );
}
