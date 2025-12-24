import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { DynamicMetaTags } from "@/components/DynamicMetaTags";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUser();
  const businessName = user?.businessName || "POS System";
  
  return {
    title: businessName,
    description: `Simple, intuitive point-of-sale system for ${businessName}`,
    manifest: "/manifest.json",
    themeColor: "#259783",
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
        <meta name="theme-color" content="#259783" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${outfit.variable} font-sans antialiased`}>
        <SessionProvider>
          <DynamicMetaTags />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
