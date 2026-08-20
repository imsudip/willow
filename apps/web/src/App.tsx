import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "./lib/auth";
import { watchTheme } from "./lib/theme";
import { LoginScreen } from "./features/auth/LoginScreen";
import { Shell } from "./app/Shell";
import { TodayScreen } from "./features/today/TodayScreen";
import { EntriesScreen } from "./features/entries/EntriesScreen";
import { EntryDetailScreen } from "./features/entries/EntryDetailScreen";
import { ReviewScreen } from "./features/entries/ReviewScreen";
import { StatsScreen } from "./features/stats/StatsScreen";
import { SettingsScreen } from "./features/settings/SettingsScreen";
import { RecordOverlay } from "./features/record/RecordOverlay";
import { startSyncEngine } from "./lib/sync";

function Gate() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (user) startSyncEngine();
  }, [user]);
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        Willow…
      </div>
    );
  }
  return user ? <AppRoutes /> : <LoginScreen />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="/" element={<TodayScreen />} />
        <Route path="/entries" element={<EntriesScreen />} />
        <Route path="/entries/:id" element={<EntryDetailScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>
      <Route path="/entries/:id/review" element={<ReviewScreen />} />
      <Route path="/record" element={<RecordOverlay />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  // Apply the stored theme once on load (defaults to light); Settings changes it.
  useEffect(() => watchTheme(), []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
