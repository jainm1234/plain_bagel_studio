import type { WorkbenchProject } from "@/components/WorkbenchFeed";

export type WorkbenchPublicProfile = {
  id: string;
  handle: string;
  displayName: string;
};

export const WORKBENCH_PROJECTS: WorkbenchProject[] = [
  {
    title: "note taker",
    href: "/projects/note-taker",
    image: "/projects/note-taker/cover.jpg",
    description:
      "a hold-to-talk notebook that lives on an esp32. press the button, speak your thought, let go. recordings sync over bluetooth (or usb) into a tiny web app that transcribes them for you.",
    socialLink: "https://www.instagram.com/p/DaA2b_IRjB3/",
    tags: ["#esp32", "#audio", "#bluetooth"],
    author: { id: "wb_malvika", handle: "malvika.jain" },
    updatedAt: "2026-08-01",
  },
];

export const WORKBENCH_PROFILES: WorkbenchPublicProfile[] = [
  {
    id: "wb_malvika",
    handle: "malvika.jain",
    displayName: "malvika",
  },
];

export function getProjectsByAuthor(authorId: string) {
  return WORKBENCH_PROJECTS.filter(
    (project) => project.author?.id === authorId,
  ).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function getPublicProfile(authorId: string) {
  const known = WORKBENCH_PROFILES.find((profile) => profile.id === authorId);
  if (known) return known;

  const fromProject = WORKBENCH_PROJECTS.find(
    (project) => project.author?.id === authorId,
  )?.author;

  if (fromProject) {
    return {
      id: fromProject.id,
      handle: fromProject.handle,
      displayName: fromProject.handle,
    };
  }

  return null;
}

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "can",
  "for",
  "i",
  "in",
  "is",
  "make",
  "of",
  "the",
  "to",
  "using",
  "what",
  "with",
]);

export function workbenchSearchTokens(query: string) {
  return query
    .toLowerCase()
    .replace(/[?!,.]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token));
}

export function projectMatchesWorkbenchQuery(
  project: WorkbenchProject,
  query: string,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    project.title,
    project.description,
    project.author?.handle ?? "",
    ...project.tags,
    project.comingSoon ? "coming soon" : "project",
    project.tags.includes("#beginner") || /starter|kit|beginner/i.test(project.title)
      ? "first beginner starter"
      : "",
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes(q)) return true;

  const tokens = workbenchSearchTokens(q);
  if (!tokens.length) return false;

  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits >= Math.min(2, tokens.length);
}

export function searchWorkbenchProjects(
  query: string,
  excludeHrefs: string[] = [],
  catalog: WorkbenchProject[] = WORKBENCH_PROJECTS,
) {
  const excluded = new Set(excludeHrefs);

  const available = catalog.filter(
    (project) => !excluded.has(project.href) && !project.comingSoon,
  );

  if (!query.trim()) return [];

  return available
    .filter((project) => projectMatchesWorkbenchQuery(project, query))
    .slice(0, 8);
}

function projectKey(project: WorkbenchProject) {
  const title = project.title.trim().toLowerCase();
  const author = (project.author?.handle || project.author?.id || "")
    .trim()
    .toLowerCase()
    .replace(/[._-]/g, "");
  return `${title}::${author}`;
}

/** Merge seeded + Supabase projects without showing the same project twice. */
export function mergeFeedProjects(
  seeded: WorkbenchProject[],
  fromDb: WorkbenchProject[],
  idFromHref: (href: string) => string,
) {
  const usedDb = new Set<string>();

  function matchDb(project: WorkbenchProject) {
    const id = idFromHref(project.href);
    const key = projectKey(project);
    return (
      fromDb.find((row) => idFromHref(row.href) === id) ||
      fromDb.find((row) => row.href === project.href) ||
      fromDb.find((row) => projectKey(row) === key)
    );
  }

  const mergedSeeded = seeded.map((project) => {
    const db = matchDb(project);
    if (!db) return project;
    usedDb.add(db.href);
    return {
      ...project,
      title: db.title || project.title,
      image: db.image || project.image,
      description: db.description || project.description,
      socialLink: db.socialLink || project.socialLink,
      author: db.author || project.author,
      updatedAt: db.updatedAt || project.updatedAt,
    };
  });

  const extras = fromDb.filter((project) => {
    if (usedDb.has(project.href)) return false;
    if (mergedSeeded.some((seed) => seed.href === project.href)) return false;
    if (
      mergedSeeded.some(
        (seed) => idFromHref(seed.href) === idFromHref(project.href),
      )
    ) {
      return false;
    }
    if (mergedSeeded.some((seed) => projectKey(seed) === projectKey(project))) {
      return false;
    }
    return true;
  });

  return [...mergedSeeded, ...extras];
}
