import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FRONTIER | イベントと、つながる。",
  description: "フロンティア専用イベント管理",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
