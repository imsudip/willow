import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createAuthClient } from "better-auth/react";

// Same-origin by design: the Vercel /api rewrite (prod) and the Vite proxy
// (dev) forward /api/auth/* to the API, so the auth client needs no baseURL.
const authClient = createAuthClient();

interface AuthState {
  user: { id: string; email: string; name?: string } | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState["user"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      setUser(data?.user ?? null);
      setLoading(false);
    });
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await authClient.signUp.email({
      email,
      password,
      name,
    });
    if (error) throw new Error(error.message ?? "Sign up failed");
    // No window.location.reload() — setUser re-renders the Gate to the app
    // immediately, avoiding a hard reload (which is slow in dev and makes
    // the SPA re-mount from scratch).
    setUser(data?.user ?? null);
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) throw new Error(error.message ?? "Sign in failed");
    setUser(data?.user ?? null);
  };

  const signOut = async () => {
    await authClient.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
