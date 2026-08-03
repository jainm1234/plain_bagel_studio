import type { Metadata } from "next";
import WorkbenchFeed from "@/components/WorkbenchFeed";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  WORKBENCH_PROJECTS,
  mergeFeedProjects,
} from "@/lib/workbenchProjects";
import { listPosts, projectFromRecord } from "@/lib/workbenchPostsDb";
import { postIdFromHref } from "@/lib/workbenchReactions";

export const metadata: Metadata = {
  title: "work bench",
};

export const dynamic = "force-dynamic";

export default async function WorkBenchPage() {
  let dbProjects = [] as ReturnType<typeof projectFromRecord>[];

  if (isSupabaseConfigured()) {
    try {
      const rows = await listPosts();
      dbProjects = rows.map(projectFromRecord);
    } catch {
      dbProjects = [];
    }
  }

  const projects = mergeFeedProjects(
    WORKBENCH_PROJECTS,
    dbProjects,
    postIdFromHref,
  );

  return (
    <main className="workbench-site">
      <WorkbenchFeed projects={projects} />
    </main>
  );
}
