import { useEffect, useState } from "react";
import { Bell, Moon, Volume2, KeyRound, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { client } from "../../lib/api";
import { db } from "../../lib/db";
import { applyTheme, getAppearance, type Appearance } from "../../lib/theme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
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

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [reminderTime, setReminderTime] = useState("18:30");
  const [chimes, setChimes] = useState(true);
  const [appearance, setAppearance] = useState<Appearance>("light");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [openaiKeyConfigured, setOpenaiKeyConfigured] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyMsg, setKeyMsg] = useState<{ text: string; error: boolean } | null>(null);

  // Load settings: server-side user_config is the source of truth; fall back
  // to the local Dexie cache when offline / not yet synced.
  useEffect(() => {
    (async () => {
      const [t, c, a] = await Promise.all([
        db.settings.get("reminderTime"),
        db.settings.get("chimes"),
        getAppearance(),
      ]);
      let localT = t?.value as string | undefined;
      let localC = c?.value as boolean | undefined;
      let localA = a;
      try {
        const cfg = await client.getUserConfig();
        if (cfg.reminderTime) localT = cfg.reminderTime;
        if (cfg.chimesEnabled !== undefined) localC = cfg.chimesEnabled;
        if (cfg.appearance) localA = cfg.appearance;
        setOpenaiKeyConfigured(cfg.openaiKeyConfigured);
      } catch {
        // Offline — keep the local cache values.
      }
      if (localT) setReminderTime(localT);
      if (localC !== undefined) setChimes(localC);
      setAppearance(localA);
    })();
  }, []);

  // Apply the theme immediately when the choice changes (no global side effects)
  useEffect(() => {
    applyTheme(appearance);
  }, [appearance]);

  // Check push subscription state
  useEffect(() => {
    navigator.serviceWorker?.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setPushEnabled(Boolean(sub)))
      .catch(() => {});
  }, []);

  async function save() {
    await db.settings.put({ key: "reminderTime", value: reminderTime });
    await db.settings.put({ key: "chimes", value: chimes });
    await db.settings.put({ key: "appearance", value: appearance });
    // Persist server-side too (best effort — ignore offline errors).
    try {
      await client.updateUserConfig({
        reminderTime,
        chimesEnabled: chimes,
        appearance,
      });
    } catch {
      /* offline: local cache keeps working */
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function saveOpenaiKey() {
    const value = apiKeyInput.trim();
    setKeyMsg(null);
    try {
      const res = await client.setOpenaiKey(value === "" ? null : value);
      setOpenaiKeyConfigured(res.openaiKeyConfigured);
      setApiKeyInput("");
      setKeyMsg({
        text: value === "" ? "Key removed." : "Key saved. It's encrypted at rest and never leaves the server.",
        error: false,
      });
    } catch (err) {
      setKeyMsg({ text: err instanceof Error ? err.message : "Failed to save key", error: true });
    }
  }

  async function togglePush() {
    if (pushEnabled) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await client.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setPushEnabled(false);
    } else {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string | undefined;
      if (!vapidPublicKey) {
        setPushError("Push notifications aren't configured on this server yet.");
        return;
      }
      setPushError(null);
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      await client.subscribePush(sub);
      setPushEnabled(true);
    }
  }

  return (
    <div className="fade-up space-y-6">
      <h1 className="pt-2 font-serif text-2xl font-normal text-balance">Settings</h1>

      {user && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <p className="font-medium">{user.name || user.email}</p>
          <p className="text-sm text-muted">{user.email}</p>
        </section>
      )}

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-3" htmlFor="reminder">
            <Bell className="h-5 w-5 text-muted" aria-hidden />
            <span>
              <span className="block text-sm font-medium">Evening reminder</span>
              <span className="block text-xs text-muted">A nudge to ramble, if you haven't yet</span>
            </span>
          </label>
          <input
            id="reminder"
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            className="min-h-11 rounded-lg border border-line bg-canvas px-3 text-base sm:text-sm"
          />
        </div>

        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <Moon className="h-5 w-5 text-muted" aria-hidden />
            <span className="text-sm font-medium">Appearance</span>
          </span>
          <Select value={appearance} onValueChange={(v) => setAppearance(v as Appearance)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <Volume2 className="h-5 w-5 text-muted" aria-hidden />
            <span className="text-sm font-medium">Chimes</span>
          </span>
          <Switch checked={chimes} onCheckedChange={setChimes} aria-label="Chimes" />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted" aria-hidden />
            <span className="text-sm font-medium">Push notifications</span>
          </span>
          <Switch checked={pushEnabled} onCheckedChange={() => void togglePush()} aria-label="Push notifications" />
        </label>
        {pushError && (
          <p className="text-sm text-danger" role="alert">
            {pushError}
          </p>
        )}

        <button
          onClick={save}
          className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-ink"
        >
          {saved ? "Saved" : "Save settings"}
        </button>
      </section>

      {/* Bring-your-own OpenAI key — stored encrypted server-side, used only
          for this account's transcription / cleanup / prompts / digest. */}
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center gap-3">
          <KeyRound className="h-5 w-5 text-muted" aria-hidden />
          <div>
            <p className="text-sm font-medium">OpenAI key (optional)</p>
            <p className="text-xs text-muted">
              Bring your own key for transcription, cleanup, prompts &amp; digest. Encrypted at rest;
              it never leaves the server.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="password"
            placeholder={openaiKeyConfigured ? "•••••••• (set — enter to replace)" : "sk-…"}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            autoComplete="off"
            className="min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm"
          />
          <button
            onClick={() => void saveOpenaiKey()}
            className="whitespace-nowrap rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-ink"
          >
            {apiKeyInput.trim() === "" && openaiKeyConfigured ? "Remove" : "Save key"}
          </button>
        </div>
        {openaiKeyConfigured && !apiKeyInput && (
          <p className="text-xs text-emerald-500">A key is set for this account.</p>
        )}
        {keyMsg && (
          <p className={`text-xs ${keyMsg.error ? "text-danger" : "text-emerald-500"}`}>
            {keyMsg.text}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 py-3 text-sm font-medium text-danger">
              <Trash2 className="h-4 w-4" aria-hidden /> Clear all local data
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all local data?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes every entry and recording from this device. Anything not yet synced to
                the server will be lost. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="min-h-11 rounded-xl border border-[var(--border)] px-4 text-sm font-medium text-[var(--muted-foreground)]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await db.entries.clear();
                  await db.audio.clear();
                }}
                className="min-h-11 rounded-xl bg-[var(--destructive)] px-4 text-sm font-medium text-white"
              >
                Clear everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <button
          onClick={() => void signOut()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-medium text-muted"
        >
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </section>
    </div>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Url);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
