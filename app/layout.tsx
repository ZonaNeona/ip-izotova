import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WB AI Control Center",
  description: "Demo marketplace operations control center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
