import type { ReactNode } from "react";
import { createElement } from "react";

export type MarkedPart = {
  id: string;
  name: string;
  code: string;
  color: string;
  phrases: string[];
};

const PART_COLORS = [
  "#c45c4a",
  "#3a6ea5",
  "#3d8b6e",
  "#c47a3a",
  "#8b5e9a",
  "#5a8f9a",
  "#a35d7a",
  "#6b7a3a",
];

const PROGRESS_KEY = "workbench.buildProgress.v1";

export type BuildProgress = {
  materials: string[];
  steps: string[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function partCode(index: number) {
  return String.fromCharCode(65 + (index % 26));
}

function phrasesForName(name: string) {
  const phrases = new Set<string>();
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return [];
  phrases.add(trimmed);

  for (const chunk of trimmed.split(/\s*(?:\+|\/|,|&| and )\s*/i)) {
    const piece = chunk.trim();
    if (piece.length < 3) continue;
    phrases.add(piece);
    phrases.add(piece.replace(/s$/, ""));
  }

  if (/esp32/i.test(trimmed)) {
    phrases.add("esp32");
    phrases.add("esp32-s3");
    phrases.add("esp32-s3 sense");
  }
  if (/usb/i.test(trimmed)) {
    phrases.add("usb cable");
    phrases.add("usb-c");
    phrases.add("usb-c cable");
  }
  if (/jumper/i.test(trimmed)) {
    phrases.add("jumper wires");
    phrases.add("jumper wire");
  }
  if (/\bled\b/i.test(trimmed)) phrases.add("led");
  if (/resistor/i.test(trimmed)) phrases.add("resistor");
  if (/button/i.test(trimmed)) phrases.add("button");
  if (/breadboard/i.test(trimmed)) phrases.add("breadboard");

  return [...phrases].sort((a, b) => b.length - a.length);
}

export function marksForParts(
  parts: Array<{ id: string; name: string }>,
): MarkedPart[] {
  return parts.map((part, index) => ({
    id: part.id,
    name: part.name,
    code: partCode(index),
    color: PART_COLORS[index % PART_COLORS.length],
    phrases: phrasesForName(part.name),
  }));
}

export function highlightPartText(
  text: string,
  marks: MarkedPart[],
): ReactNode {
  const usable = marks.filter((mark) => mark.phrases.length);
  if (!text || !usable.length) return text;

  const allPhrases = usable.flatMap((mark) => mark.phrases);
  const unique = [...new Set(allPhrases)].sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`\\b(?:${unique.map(escapeRegExp).join("|")})\\b`, "gi");
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text))) {
    const start = match.index;
    const chunk = match[0];
    if (start > last) nodes.push(text.slice(last, start));
    const mark = usable.find((item) =>
      item.phrases.some((phrase) => phrase.toLowerCase() === chunk.toLowerCase()),
    );
    nodes.push(
      createElement(
        "mark",
        {
          key: `m${key}`,
          className: "workbench-part-hit",
          style: mark
            ? { color: mark.color, background: `${mark.color}1a` }
            : undefined,
        },
        chunk,
      ),
    );
    key += 1;
    last = start + chunk.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : text;
}

function progressKey(postId: string, userId?: string | null) {
  return `${userId?.trim() || "anon"}::${postId}`;
}

function readAllProgress(): Record<string, BuildProgress> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, BuildProgress>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadBuildProgress(
  postId: string,
  userId?: string | null,
): BuildProgress {
  const all = readAllProgress();
  const row = all[progressKey(postId, userId)] || all[postId];
  return {
    materials: Array.isArray(row?.materials) ? row.materials : [],
    steps: Array.isArray(row?.steps) ? row.steps : [],
  };
}

export function saveBuildProgress(
  postId: string,
  progress: BuildProgress,
  userId?: string | null,
) {
  try {
    const all = readAllProgress();
    all[progressKey(postId, userId)] = {
      materials: [...new Set(progress.materials)],
      steps: [...new Set(progress.steps)],
    };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {
    // ignore quota / private mode
  }
}

export function mergeBuildProgress(a: BuildProgress, b: BuildProgress): BuildProgress {
  return {
    materials: [...new Set([...a.materials, ...b.materials])],
    steps: [...new Set([...a.steps, ...b.steps])],
  };
}

export async function fetchBuildProgress(postId: string): Promise<BuildProgress | null> {
  const response = await fetch(
    `/api/progress?postId=${encodeURIComponent(postId)}`,
  );
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error("Could not load progress");
  }
  const data = (await response.json()) as BuildProgress & { error?: string };
  return {
    materials: Array.isArray(data.materials) ? data.materials : [],
    steps: Array.isArray(data.steps) ? data.steps : [],
  };
}

export async function persistBuildProgress(
  postId: string,
  progress: BuildProgress,
) {
  const response = await fetch("/api/progress", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, ...progress }),
  });
  if (response.status === 401) return progress;
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "Could not save progress");
  }
  return progress;
}
