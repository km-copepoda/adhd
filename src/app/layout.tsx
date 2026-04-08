import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Cinzel } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import IOSInstallPrompt from "@/components/IOSInstallPrompt";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "QuestBoard",
  description: "クエストをクリアしてモンスターを育てよう！",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "QuestBoard",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07080f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.variable} ${cinzel.variable} font-sans antialiased`}>
        <ServiceWorkerRegistration />
        <IOSInstallPrompt />
        {children}
      </body>
    </html>
  );
}
