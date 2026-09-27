import type { Metadata } from "next";
import "@fontsource-variable/dm-sans/index.css";
import "@fontsource-variable/dm-sans/wght-italic.css";
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
// Plus Jakarta Sans is kept only for the Waypoint wordmark.
import "@fontsource/plus-jakarta-sans/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "Waypoint — A better way forward",
  description:
    "A connected delivery experience. Interactive Designathon prototype for Waypoint Group.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
