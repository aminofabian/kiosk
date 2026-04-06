import type { Metadata, Viewport } from "next";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { DynamicMetaTags } from "@/components/DynamicMetaTags";
import { Toaster } from "sonner";
import { getCurrentUser } from "@/lib/auth";
import { SerwistProvider } from "./serwist";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#1c6a1e",
  /** Lets `env(safe-area-inset-*)` apply when installed as a web app or in Safari. */
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  const businessName = user?.businessName || "POS System";
  
  return {
    title: businessName,
    description: `Simple, intuitive point-of-sale system for ${businessName}`,
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: businessName,
    },
    icons: {
      icon: "/icon-192.png",
      apple: "/icon-192.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1c6a1e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="font-sans antialiased">
        <SerwistProvider
          swUrl="/sw.js"
          disable={
            process.env.NODE_ENV === 'development' ||
            process.env.NEXT_PUBLIC_DISABLE_SERVICE_WORKER === 'true'
          }
        >
          <SessionProvider>
            <DynamicMetaTags />
            {children}
            <Toaster position="top-center" richColors closeButton />
          </SessionProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
