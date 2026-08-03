import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "your first robotics simulation project — plain bagel studios",
};

export default function RoboticsSimulationProjectPage() {
  return (
    <main className="publication">
      <Header />
    </main>
  );
}
