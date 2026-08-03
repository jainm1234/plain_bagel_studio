import type { Metadata } from "next";
import type { WorkbenchProject } from "@/components/WorkbenchFeed";
import WorkbenchFeed from "@/components/WorkbenchFeed";
import { isSupabaseConfigured } from "@/lib/supabase";
import { WORKBENCH_PROJECTS } from "@/lib/workbenchProjects";
import { listPosts, projectFromRecord } from "@/lib/workbenchPostsDb";

export const metadata: Metadata = {
  title: "work bench",
};

export const dynamic = "force-dynamic";

export default async function WorkBenchPage() {
  let dbProjects: WorkbenchProject[] = [];

  if (isSupabaseConfigured()) {
    try {
      const rows = await listPosts();
      dbProjects = rows.map(projectFromRecord);
    } catch {
      dbProjects = [];
    }
  }

  const seededHrefs = new Set(WORKBENCH_PROJECTS.map((project) => project.href));
  const projects = [
    ...WORKBENCH_PROJECTS,
    ...dbProjects.filter((project) => !seededHrefs.has(project.href)),
  ];

  return (
    <main className="workbench-site">
      <WorkbenchFeed projects={projects} />
    </main>
  );
}
