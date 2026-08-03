import type { Metadata } from "next";
import WorkbenchFeed from "@/components/WorkbenchFeed";
import { WORKBENCH_PROJECTS } from "@/lib/workbenchProjects";

export const metadata: Metadata = {
  title: "work bench",
};

export default function WorkBenchPage() {
  return (
    <main className="workbench-site">
      <WorkbenchFeed projects={WORKBENCH_PROJECTS} />
    </main>
  );
}
