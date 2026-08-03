import type { Metadata } from "next";
import localFont from "next/font/local";
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
        <WorkbenchAuthProvider>
          {children}
          <SubmitProjectFlow variant="host" />
          <MailingListPopover />
        </WorkbenchAuthProvider>
      </body>
    </html>
  );
}
