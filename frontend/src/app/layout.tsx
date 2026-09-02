import type { Metadata } from "next";
import { Inter, Sarabun } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Brand body face — labalancephysio.com uses Sarabun for both Thai and Latin.
const sarabun = Sarabun({
  variable: "--font-sarabun",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LA BALANCE Clinic ERP",
  description: "Clinic management system for physiotherapy operations",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      className={`${inter.variable} ${sarabun.variable} h-full antialiased`}
    >
      {/*
        Extensions such as Grammarly stamp their own attributes onto <body>
        before React hydrates, which the server render cannot know about. The
        suppression covers this element's own attributes only — a genuine
        mismatch anywhere inside the app is still reported.
      */}
      <body className="min-h-full" suppressHydrationWarning>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </TooltipProvider>
      </body>
    </html>
  );
}
