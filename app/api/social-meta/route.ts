import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Meta = {
  title?: string;
  description?: string;
  site?: string;
};

function siteFromHost(host: string) {
  const h = host.replace(/^www\./, "");
  if (h.includes("instagram")) return "instagram";
  if (h.includes("tiktok")) return "tiktok";
  if (h.includes("youtube") || h.includes("youtu.be")) return "youtube";
  if (h.includes("x.com") || h.includes("twitter")) return "x";
  if (h.includes("reddit")) return "reddit";
  return h;
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return null;
  return response.json();
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")?.trim() || "";
  if (!url) {
    return NextResponse.json({ error: "missing url" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const meta: Meta = { site: siteFromHost(parsed.hostname) };

  try {
    const noembed = await fetchJson(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
    );
    if (noembed?.title) meta.title = String(noembed.title);
    if (noembed?.author_name && !meta.description) {
      meta.description = `by ${String(noembed.author_name)}`;
    }
  } catch {
    // ignore
  }

  if (!meta.title && /youtube\.com|youtu\.be/i.test(parsed.hostname)) {
    try {
      const yt = await fetchJson(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      );
      if (yt?.title) meta.title = String(yt.title);
      if (yt?.author_name) meta.description = `by ${String(yt.author_name)}`;
    } catch {
      // ignore
    }
  }

  if (!meta.title && /tiktok\.com/i.test(parsed.hostname)) {
    try {
      const tiktok = await fetchJson(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      );
      if (tiktok?.title) meta.title = String(tiktok.title);
      if (tiktok?.author_name) {
        meta.description = `by ${String(tiktok.author_name)}`;
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json(meta);
}
