import { ZLoader } from "@/components/brand/z-loader";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider, themeInitScript } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ZevaPay: know the moment a bKash or Nagad payment lands",
    template: "%s | ZevaPay",
  },
  description:
    "ZevaPay is a simple payment management platform for Bangladeshi merchants. Connect bKash, Nagad, Rocket, and Upay accounts, pair an Android device, and review every recorded payment notification in one dashboard.",
  applicationName: "ZevaPay",
  keywords: [
    "payment management",
    "bKash",
    "Nagad",
    "Rocket",
    "Upay",
    "merchant dashboard",
    "transaction tracking",
    "SMS bridge",
  ],
  openGraph: {
    title: "ZevaPay: know the moment a bKash or Nagad payment lands",
    description:
      "ZevaPay reads the payment SMS on your phone, matches the TrxID and amount, and tells your website the order is paid.",
    type: "website",
    siteName: "ZevaPay",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZevaPay: know the moment a bKash or Nagad payment lands",
    description:
      "ZevaPay reads the payment SMS on your phone, matches the TrxID and amount, and tells your website the order is paid.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the stored theme before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-canvas text-ink">
        {/* A short Z splash on a full load or reload. Fades out by itself. */}
        <div className="zp-splash" aria-hidden="true">
          <ZLoader className="w-28" />
        </div>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
