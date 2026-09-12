import type { Metadata } from "next";
import "./globals.css";
import "./shop.css";
import "./enhancements.css";
import "./polish.css";
import "./revisions.css";

export const metadata: Metadata = {
  title: "Джентельмен — цветочная мастерская",
  description: "Свежие букеты и цветочные композиции с доставкой и самовывозом.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
