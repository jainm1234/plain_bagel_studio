import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "publication — plain bagel studios",
};

const writings = [
  {
    title: "chatting on the 5th floor of the moma",
    href: "/publication/chatting-on-the-5th-floor-of-the-moma",
  },
];

export default function PublicationPage() {
  return (
    <main className="publication">
      <Header />
      <nav className="publication-list">
        {writings.map((writing) => (
          <Link key={writing.href} href={writing.href}>
            {writing.title}
          </Link>
        ))}
      </nav>
    </main>
  );
}
