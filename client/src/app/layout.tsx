import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ResearcherGPT - AI-Powered Academic Workspace",
  description: "Generate citation-backed, source-verifiable research papers using RAG, LangGraph, and multi-agent workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // If Clerk publishable key is not active or set to a placeholder, we can supply a default fallback bypass key
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_mock_clerk_pub_key';

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <html lang="en" className="dark">
        <body className={`${inter.className} antialiased bg-background text-foreground`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
