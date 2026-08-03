export type WorkbenchComment = {
  id: string;
  postId: string;
  body: string;
  authorId: string;
  authorHandle: string;
  createdAt: string;
};

const STORAGE_KEY = "workbench.comments.v1";

function readAll(): WorkbenchComment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkbenchComment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(comments: WorkbenchComment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
}

export function getCommentsForPost(postId: string) {
  return readAll()
    .filter((comment) => comment.postId === postId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

export function addComment(input: {
  postId: string;
  body: string;
  authorId: string;
  authorHandle: string;
}) {
  const body = input.body.trim();
  if (!body) return null;

  const comment: WorkbenchComment = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `c_${crypto.randomUUID().slice(0, 8)}`
        : `c_${Math.random().toString(36).slice(2, 10)}`,
    postId: input.postId,
    body,
    authorId: input.authorId,
    authorHandle: input.authorHandle,
    createdAt: new Date().toISOString(),
  };

  const next = [...readAll(), comment];
  writeAll(next);
  return comment;
}

const PENDING_KEY = "workbench.pendingComment.v1";

export type PendingComment = {
  postId: string;
  body: string;
};

export function setPendingComment(pending: PendingComment) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* ignore */
  }
}

export function peekPendingComment(postId: string): PendingComment | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingComment;
    if (parsed?.postId !== postId || !parsed.body?.trim()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingComment() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

export function takePendingComment(postId: string): PendingComment | null {
  const pending = peekPendingComment(postId);
  if (pending) clearPendingComment();
  return pending;
}
