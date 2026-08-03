import type { Metadata } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import MailingListPopover from "@/components/MailingListPopover";
import SubmitProjectFlow from "@/components/SubmitProjectFlow";
import { WorkbenchAuthProvider } from "@/components/WorkbenchAuth";
import "./globals.css";

const suisseIntl = localFont({
  src: "./fonts/SuisseIntl-Regular.ttf",
  display: "swap",
  variable: "--font-suisse",
});

export const metadata: Metadata = {
  title: "plain bagel studios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${suisseIntl.variable} ${suisseIntl.className}`}>
        <ClerkProvider afterSignOutUrl="/work-bench">
          <WorkbenchAuthProvider>
            {children}
            <SubmitProjectFlow variant="host" />
            <MailingListPopover />
          </WorkbenchAuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
