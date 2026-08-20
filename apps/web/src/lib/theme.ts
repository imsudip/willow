import { db } from "./db";

export type Appearance = "light" | "dark" | "system";

/**
 * Applies the theme by toggling the `dark` class on <html>.
 * Defaults to LIGHT: the app only goes dark if the user explicitly picks "dark"
 * (or "system" with a dark OS). The dark palette exists but is opt-in.
 */
export function applyTheme(appearance: Appearance) {
  const dark =
    appearance === "dark" ||
    (appearance === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export async function getAppearance(): Promise<Appearance> {
  const row = await db.settings.get("appearance");
  return (row?.value as Appearance) ?? "light";
}

/** Applies the stored theme once on load. Returns a cleanup function. */
export function watchTheme() {
  void getAppearance().then(applyTheme);
  return () => {};
}
