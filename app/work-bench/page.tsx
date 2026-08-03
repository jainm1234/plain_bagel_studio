import type { Metadata } from "next";
import type { WorkbenchProject } from "@/components/WorkbenchFeed";
import WorkbenchFeed from "@/components/WorkbenchFeed";
import { isSupabaseConfigured } from "@/lib/supabase";
import { WORKBENCH_PROJECTS } from "@/lib/workbenchProjects";
import { listPosts, projectFromRecord } from "@/lib/workbenchPostsDb";
import { postIdFromHref } from "@/lib/workbenchReactions";

export const metadata: Metadata = {
  title: "work bench",
};

export const dynamic = "force-dynamic";

function projectKey(project: WorkbenchProject) {
  const title = project.title.trim().toLowerCase();
  const author = (
    project.author?.handle ||
    project.author?.id ||
    ""
  )
    .trim()
    .toLowerCase()
    .replace(/[._-]/g, "");
  return `${title}::${author}`;
}

function mergeFeedProjects(
  seeded: WorkbenchProject[],
  fromDb: WorkbenchProject[],
) {
  const seededIds = new Set(
    seeded.map((project) => postIdFromHref(project.href)),
  );
  const seededKeys = new Set(seeded.map(projectKey));
  const seededHrefs = new Set(seeded.map((project) => project.href));

  // Prefer the seeded note-taker (and any other static projects) over a
  // Supabase copy created when someone edited/saved the same project.
  const extras = fromDb.filter((project) => {
    if (seededHrefs.has(project.href)) return false;
    const id = postIdFromHref(project.href);
    if (seededIds.has(id)) return false;
    if (seededKeys.has(projectKey(project))) return false;
    return true;
  });

  return [...seeded, ...extras];
}

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

  const projects = mergeFeedProjects(WORKBENCH_PROJECTS, dbProjects);

  return (
    <main className="workbench-site">
      <WorkbenchFeed projects={projects} />
    </main>
  );
}
