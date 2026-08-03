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
    author: { id: "wb_malvika", handle: "malvika" },
    updatedAt: "2026-08-01",
  },
];

export const WORKBENCH_PROFILES: WorkbenchPublicProfile[] = [
  {
    id: "wb_malvika",
    handle: "malvika",
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

export const WORKBENCH_SEARCH_SUGGESTIONS = [
  {
    label: "what is a good first project?",
    query: "beginner first starter kit",
  },
  {
    label: "what can i make using an esp32 and leds?",
    query: "esp32 led",
  },
  {
    label: "hold to talk / voice projects",
    query: "audio microphone bluetooth",
  },
  {
    label: "projects with a button",
    query: "button",
  },
  {
    label: "robotics and simulation",
    query: "robotics simulation",
  },
  {
    label: "bluetooth hardware builds",
    query: "bluetooth ble",
  },
] as const;

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

export function resolveWorkbenchSearchQuery(query: string) {
  const trimmed = query.trim().toLowerCase();
  const suggestion = WORKBENCH_SEARCH_SUGGESTIONS.find(
    (item) => item.label === trimmed,
  );
  return suggestion ? `${query} ${suggestion.query}` : query;
}

export function projectMatchesWorkbenchQuery(
  project: WorkbenchProject,
  query: string,
) {
  const resolved = resolveWorkbenchSearchQuery(query);
  const q = resolved.trim().toLowerCase();
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

export function searchWorkbenchProjects(query: string, excludeHrefs: string[] = []) {
  const excluded = new Set(excludeHrefs);

  const available = WORKBENCH_PROJECTS.filter(
    (project) => !excluded.has(project.href) && !project.comingSoon,
  );

  if (!query.trim()) return available.slice(0, 6);

  return available
    .filter((project) => projectMatchesWorkbenchQuery(project, query))
    .slice(0, 8);
}
