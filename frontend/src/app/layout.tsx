import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AccessibilityProvider from "@/components/providers/AccessibilityProvider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";

// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const preferredRegion = 'auto';

export const metadata: Metadata = {
  title: "BetterPrompts - AI Prompt Engineering Made Simple",
  description: "Democratizing advanced prompt engineering techniques. Transform your ideas into optimized prompts with AI-powered suggestions.",
  keywords: "prompt engineering, AI prompts, LLM optimization, chain of thought, few-shot learning",
  authors: [{ name: "BetterPrompts Team" }],
  openGraph: {
    title: "BetterPrompts - AI Prompt Engineering Made Simple",
    description: "Transform your ideas into optimized prompts with AI-powered suggestions.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className="flex min-h-full flex-col bg-white text-gray-900 antialiased font-sans"
      >
        <ThemeProvider>
          <AccessibilityProvider>
            <Header />
            <main id="main-content" className="flex-1">
              {children}
            </main>
            <Footer />
            <Toaster />
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
