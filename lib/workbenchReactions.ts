const STORAGE_KEY = "workbench.reactions.v1";
const REACTOR_KEY = "workbench.reactorId.v1";

type ReactionMap = Record<string, { fire: string[] }>;

function readAll(): ReactionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ReactionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: ReactionMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getReactorId(userId?: string | null) {
  if (userId) return userId;
  try {
    const existing = localStorage.getItem(REACTOR_KEY);
    if (existing) return existing;
    const next =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `anon_${crypto.randomUUID().slice(0, 8)}`
        : `anon_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(REACTOR_KEY, next);
    return next;
  } catch {
    return "anon_local";
  }
}

export function getFireCount(postId: string) {
  return readAll()[postId]?.fire?.length ?? 0;
}

export function hasFired(postId: string, reactorId: string) {
  return (readAll()[postId]?.fire ?? []).includes(reactorId);
}

export function toggleFire(postId: string, reactorId: string) {
  const map = readAll();
  const current = map[postId]?.fire ?? [];
  const active = current.includes(reactorId);
  const next = active
    ? current.filter((id) => id !== reactorId)
    : [...current, reactorId];

  if (next.length === 0) {
    const { [postId]: _, ...rest } = map;
    writeAll(rest);
  } else {
    writeAll({ ...map, [postId]: { fire: next } });
  }

  return { count: next.length, active: !active };
}

export function postIdFromHref(href: string) {
  const trimmed = href.replace(/\/$/, "");
  const match = trimmed.match(/\/projects\/([^/]+)$/);
  return match?.[1] ?? trimmed.replace(/^\//, "").replace(/\//g, "-");
}
