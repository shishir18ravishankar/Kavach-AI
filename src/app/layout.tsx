import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://kavach-ai-khaki.vercel.app");
const TITLE = "Kavach AI: a private AI assistant for your company's documents";
const DESCRIPTION =
  "Encrypted in your browser, stored on 0G, answered by sealed AI inside a TEE, and recoverable by any 2 of 3 co-founders. Nobody but your company can read your documents.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  icons: { icon: "/icon.svg" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Kavach AI",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/og.png", width: 1280, height: 720, alt: "Kavach AI: chat with your company's secrets. Nobody else can read them." }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og.png"] },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b1530" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
