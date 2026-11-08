import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { RegisterSW } from "@/components/RegisterSW";
import { NO_FLASH_SCRIPT, THEME_COLORS } from "@/lib/theme";

/** Absolute base for share-image URLs. Vercel sets the production domain; override with NEXT_PUBLIC_SITE_URL. */
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const shareTitle = "hjem — one calm place for your household";
const shareDescription = "Shared calendars, tasks, meals and groceries, and the baby log, synced for the whole family.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "hjem", template: "%s · hjem" },
  description: "One calm place for your household: shared calendars, tasks, meals and groceries.",
  applicationName: "hjem",
  // The image itself comes from src/app/opengraph-image.jpg (+ .alt.txt), which Next adds with its size and type.
  openGraph: {
    type: "website",
    siteName: "hjem",
    title: shareTitle,
    description: shareDescription,
    url: "/",
    locale: "en_GB",
    alternateLocale: ["ru_RU"],
  },
  twitter: { card: "summary_large_image", title: shareTitle, description: shareDescription },
  appleWebApp: { capable: true, title: "hjem", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192-v2.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-v2.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
