import { useState, type FormEvent } from "react";
import { useAuth } from "../../lib/auth";
import { NoiseTexture } from "../../components/ui/noise-texture";

export function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") await signUp(email, password, name);
      else await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flood relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      <NoiseTexture className="opacity-40" noiseOpacity={0.5} />
      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-4xl font-medium text-ink">Willow</h1>
          <p className="mt-2 text-muted">Ramble. We'll make sense of it.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Your name</span>
              <input
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted"
                placeholder="What should we call you?"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Email</span>
            <input
              type="email"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Password</span>
            <input
              type="password"
              className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink placeholder:text-muted"
              placeholder="8+ characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-accent py-3 font-medium text-ink disabled:opacity-60"
          >
            {busy ? "One moment…" : mode === "signup" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-medium text-muted underline decoration-line active:text-ink"
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
