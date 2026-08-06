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
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageCaption?: string | null;
  videoUrl?: string | null;
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

export type WorkbenchPostRelated = {
  title: string;
  href: string;
  authorHandle?: string;
};

export type WorkbenchPostDraft = {
  postId: string;
  projectName: string;
  lead: string;
  postHtml: string;
  socialLink: string;
  coverImage?: string | null;
  parts: WorkbenchPostPart[];
  steps: WorkbenchPostStep[];
  schematics: WorkbenchPostSchematic[];
  files: WorkbenchPostFile[];
  related?: WorkbenchPostRelated[];
};

const STORAGE_KEY = "workbench.postEdits.v1";

type EditMap = Record<string, WorkbenchPostDraft>;

function isDataUrl(value: string | null | undefined) {
  return Boolean(value && value.startsWith("data:"));
}

function mediaUrl(value?: string | null) {
  const trimmed = value?.trim() || "";
  return trimmed || null;
}

/** Drop base64 media so localStorage does not blow past browser quota. */
export function slimDraftForLocalCache(draft: WorkbenchPostDraft): WorkbenchPostDraft {
  const previous = readAll()[draft.postId];
  const previousCover = mediaUrl(previous?.coverImage);
  return {
    ...draft,
    coverImage: isDataUrl(draft.coverImage)
      ? previousCover && !isDataUrl(previousCover)
        ? previousCover
        : null
      : draft.coverImage,
    postHtml: draft.postHtml.replace(
      /src=(["'])data:[^"']+\1/gi,
      'src=$1$1',
    ),
    steps: draft.steps.map((step) => ({
      ...step,
      imageUrl: isDataUrl(step.imageUrl) ? null : step.imageUrl,
      videoUrl: isDataUrl(step.videoUrl) ? null : step.videoUrl,
    })),
    schematics: draft.schematics.map((item) => ({
      ...item,
      imageUrl: isDataUrl(item.imageUrl) ? null : item.imageUrl,
    })),
    files: draft.files.map((file) => ({
      ...file,
      // Cap cached script bodies; full content lives in Supabase.
      content:
        file.content.length > 50_000
          ? `${file.content.slice(0, 50_000)}\n/* …truncated for local cache */`
          : file.content,
    })),
  };
}

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
  const json = JSON.stringify(map);
  try {
    localStorage.setItem(STORAGE_KEY, json);
  } catch (error) {
    const quota =
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        /quota/i.test(error.message));
    if (!quota) throw error;

    // Clear bloated cache and retry once with current map only.
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // Give up on local cache; Supabase is the source of truth.
    }
  }
}

export function getPostEdit(postId: string): WorkbenchPostDraft | null {
  const draft = readAll()[postId];
  return draft?.postId ? draft : null;
}

export function savePostEdit(draft: WorkbenchPostDraft) {
  const map = readAll();
  map[draft.postId] = slimDraftForLocalCache(draft);
  writeAll(map);
}

export function removePostEdit(postId: string) {
  const map = readAll();
  if (!(postId in map)) return;
  delete map[postId];
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
    // Cached edits often store null after stripping data-URLs — don't wipe a real cover.
    coverImage: mediaUrl(overlay.coverImage) || mediaUrl(base.coverImage),
    parts: overlay.parts?.length ? overlay.parts : base.parts,
    steps: overlay.steps?.length ? overlay.steps : base.steps,
    schematics: overlay.schematics?.length ? overlay.schematics : base.schematics,
    files: overlay.files?.length ? overlay.files : base.files,
    related: overlay.related?.length ? overlay.related : base.related,
  };
}

export function isPostOwner(
  user: { id: string; handle: string } | null | undefined,
  author: { id: string; handle: string } | null | undefined,
) {
  if (!user || !author) return false;
  if (user.id === author.id) return true;
  const userHandle = user.handle.toLowerCase();
  const authorHandle = author.handle.toLowerCase();
  if (userHandle === authorHandle) return true;
  const userKey = userHandle.replace(/[._-]/g, "");
  const authorKey = authorHandle.replace(/[._-]/g, "");
  if (userKey && userKey === authorKey) return true;
  // Seeded Work Bench posts for the studio account.
  if (author.id === "wb_malvika" || authorKey === "malvikajain") {
    return userKey === "malvikajain" || userHandle === "malvika";
  }
  return false;
}

export function displayAuthorHandle(
  user: { id: string; handle: string } | null | undefined,
  author: { id: string; handle: string } | null | undefined,
) {
  if (!author) return "";
  // Own posts always use the live Workbench username so cards match the account.
  if (user && isPostOwner(user, author) && user.handle.trim()) {
    return user.handle;
  }
  return author.handle.trim();
}

export function postHref(postId: string) {
  return `/work-bench/p/${encodeURIComponent(postId)}`;
}

export function openWorkbenchEditPost(draft: WorkbenchPostDraft) {
  window.dispatchEvent(
    new CustomEvent("workbench-edit-post", { detail: draft }),
  );
}

export function openWorkbenchSubmit() {
  window.dispatchEvent(new Event("workbench-open-submit"));
}
