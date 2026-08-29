import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/lora";
import "../index.css";

const APP_NAME = "Willow";
const APP_DESCRIPTION = "Voice-first journaling. Ramble at the end of the day.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: "Willow — Voice journaling",
    template: "%s — Willow",
  },
  description: APP_DESCRIPTION,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#fffbf0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
