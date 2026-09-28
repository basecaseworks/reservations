import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reservations",
  description: "Simple room reservations with exclusive time slots.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
