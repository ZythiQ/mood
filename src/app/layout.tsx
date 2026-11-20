import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mood",
  description: "Emotion globe",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}