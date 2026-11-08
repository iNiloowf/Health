import type { Metadata, Viewport } from "next";
import { Fredoka } from "next/font/google";
import { Shell } from "@/components/shell";
import { AppProvider } from "@/lib/store";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka" });

export const metadata: Metadata = {
  title: { default: "Hearth", template: "%s · Hearth" },
  description: "A calm evening companion for chores, habits, pets, work, and the life you are building.",
  applicationName: "Hearth",
  appleWebApp: { capable: true, title: "Hearth", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff4f8" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1218" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `try{var t=localStorage.getItem("hearth-theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fredoka.variable} h-full antialiased`}>
      <body className="min-h-dvh">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <AppProvider>
          <Shell>{children}</Shell>
        </AppProvider>
      </body>
    </html>
  );
}
