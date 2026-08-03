export type SocialHints = {
  url: string;
  host: string;
  platform: string;
  title: string;
  description: string;
  image: string;
};

function hostLabel(hostname: string) {
  const host = hostname.replace(/^www\./, "");
  if (host.includes("instagram")) return "instagram";
  if (host.includes("tiktok")) return "tiktok";
  if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
  if (host.includes("x.com") || host.includes("twitter")) return "x";
  if (host.includes("reddit")) return "reddit";
  return host || "social";
}

/** Platform label from a social URL or hostname. */
export function socialPlatformLabel(urlOrHost: string) {
  try {
    if (/^https?:\/\//i.test(urlOrHost)) {
      return hostLabel(new URL(urlOrHost).hostname);
    }
  } catch {
    // fall through
  }
  return hostLabel(urlOrHost);
}

function titleFromPath(pathname: string) {
  const parts = pathname
    .split("/")
    .map((part) => decodeURIComponent(part).trim())
    .filter(Boolean)
    .filter(
      (part) =>
        !/^(p|reel|reels|status|watch|shorts|v|post|posts|share|t|r|u|user|users)$/i.test(
          part,
        ) && !/^[A-Za-z0-9_-]{8,}$/.test(part),
    );
  const candidate = parts[parts.length - 1] || "";
  return candidate
    .replace(/[_+.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Local hints from a social URL (no network). */
export function socialHintsFromUrl(url: string): SocialHints {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const platform = hostLabel(parsed.hostname);
    const title = titleFromPath(parsed.pathname);
    return {
      url: trimmed,
      host: parsed.hostname.replace(/^www\./, ""),
      platform,
      title,
      description: title
        ? `a ${platform} project${title ? `: ${title}` : ""}.`
        : `a project shared on ${platform}.`,
      image: "",
    };
  } catch {
    return {
      url: trimmed,
      host: "",
      platform: "social",
      title: "",
      description: "",
      image: "",
    };
  }
}

/** Fetch richer title/description via /api/social-meta when available. */
export async function fetchSocialHints(url: string): Promise<SocialHints> {
  const local = socialHintsFromUrl(url);
  if (!local.url) return local;

  try {
    const response = await fetch(
      `/api/social-meta?url=${encodeURIComponent(local.url)}`,
      { method: "GET" },
    );
    if (!response.ok) return local;
    const data = (await response.json()) as {
      title?: string;
      description?: string;
      site?: string;
      image?: string;
    };
    const title = (data.title || "").trim().toLowerCase() || local.title;
    const description =
      (data.description || "").trim().toLowerCase() || local.description;
    const hasRemoteImage = Boolean((data.image || "").trim() || local.image);
    return {
      ...local,
      platform: data.site || local.platform,
      title,
      description,
      // Serve through our proxy — Instagram CDN blocks browser hotlinks.
      image: hasRemoteImage
        ? `/api/social-image?url=${encodeURIComponent(local.url)}`
        : "",
    };
  } catch {
    return local;
  }
}
