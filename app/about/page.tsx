import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "about — plain bagel studios",
};

export default function AboutPage() {
  return (
    <main className="publication">
      <Header />
      <div className="about-content">
        <p>making things and living life with the people i love</p>
      </div>
    </main>
  );
}
