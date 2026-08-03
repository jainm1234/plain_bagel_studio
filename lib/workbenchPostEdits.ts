export type WorkbenchPostPart = {
  id: string;
  name: string;
  note?: string;
  buyUrl: string;
  imageSrc?: string;
};

export type WorkbenchPostStep = {
  id: string;
  title: string;
  details: string[];
};

export type WorkbenchPostSchematic = {
  id: string;
  source: "generated" | "custom" | "upload";
  edited?: boolean;
  boardLabel: string;
  buttonPin: string;
  ledPin: string;
  hasOnboardMic: boolean;
  pinMap: string;
  imageUrl?: string | null;
};

export type WorkbenchPostFile = {
  path: string;
  content: string;
};

export type WorkbenchPostDraft = {
  postId: string;
  projectName: string;
  lead: string;
  postHtml: string;
  socialLink: string;
  parts: WorkbenchPostPart[];
  steps: WorkbenchPostStep[];
  schematics: WorkbenchPostSchematic[];
  files: WorkbenchPostFile[];
};

const STORAGE_KEY = "workbench.postEdits.v1";

type EditMap = Record<string, WorkbenchPostDraft>;

function readAll(): EditMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as EditMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(map: EditMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function getPostEdit(postId: string): WorkbenchPostDraft | null {
  const draft = readAll()[postId];
  return draft?.postId ? draft : null;
}

export function savePostEdit(draft: WorkbenchPostDraft) {
  const map = readAll();
  map[draft.postId] = draft;
  writeAll(map);
}

export function mergePostDraft(
  base: WorkbenchPostDraft,
  overlay?: WorkbenchPostDraft | null,
): WorkbenchPostDraft {
  if (!overlay) return base;
  return {
    ...base,
    ...overlay,
    postId: base.postId,
    parts: overlay.parts?.length ? overlay.parts : base.parts,
    steps: overlay.steps?.length ? overlay.steps : base.steps,
    schematics: overlay.schematics?.length ? overlay.schematics : base.schematics,
    files: overlay.files?.length ? overlay.files : base.files,
  };
}

export function isPostOwner(
  user: { id: string; handle: string } | null | undefined,
  author: { id: string; handle: string } | null | undefined,
) {
  if (!user || !author) return false;
  if (user.id === author.id) return true;
  return user.handle.toLowerCase() === author.handle.toLowerCase();
}

export function openWorkbenchEditPost(draft: WorkbenchPostDraft) {
  window.dispatchEvent(
    new CustomEvent("workbench-edit-post", { detail: draft }),
  );
}

export function openWorkbenchSubmit() {
  window.dispatchEvent(new Event("workbench-open-submit"));
}
