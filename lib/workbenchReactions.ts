export function postIdFromHref(href: string) {
  const trimmed = href.replace(/\/$/, "");
  const workbench = trimmed.match(/\/work-bench\/p\/([^/?#]+)$/);
  if (workbench?.[1]) return decodeURIComponent(workbench[1]);
  const project = trimmed.match(/\/projects\/([^/]+)$/);
  if (project?.[1]) return decodeURIComponent(project[1]);
  return trimmed.replace(/^\//, "").replace(/\//g, "-");
}

export async function fetchLikeState(postId: string, reactorId?: string | null) {
  const params = new URLSearchParams({ postId });
  if (reactorId) params.set("reactorId", reactorId);
  const response = await fetch(`/api/likes?${params.toString()}`);
  if (!response.ok) {
    return { count: 0, liked: false, configured: false };
  }
  return (await response.json()) as {
    count: number;
    liked: boolean;
    configured?: boolean;
  };
}

export async function toggleLikeRemote(postId: string, reactorId: string) {
  const response = await fetch("/api/likes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, reactorId }),
  });
  const data = (await response.json().catch(() => ({}))) as {
    count?: number;
    liked?: boolean;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(data.error || "Could not update like");
  }
  return {
    count: data.count ?? 0,
    liked: Boolean(data.liked),
  };
}
