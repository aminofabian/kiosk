import type { Metadata } from "next";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { DynamicMetaTags } from "@/components/DynamicMetaTags";
import { Toaster } from "sonner";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  const businessName = user?.businessName || "POS System";
  
  return {
    title: businessName,
    description: `Simple, intuitive point-of-sale system for ${businessName}`,
    manifest: "/manifest.json",
    themeColor: "#1c6a1e",
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
        <SessionProvider>
          <DynamicMetaTags />
          {children}
          <Toaster position="top-center" richColors closeButton />
        </SessionProvider>
      </body>
    </html>
  );
}
