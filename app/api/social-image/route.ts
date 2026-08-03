import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!response.ok) return null;
  return response.json() as Promise<Record<string, unknown>>;
}

function pickImage(data: Record<string, unknown> | null) {
  if (!data) return "";
  const image =
    data.thumbnail_url ||
    data.thumbnail ||
    data.image ||
    data.thumbnail_url_with_play_button;
  return typeof image === "string" ? image.trim() : "";
}

async function resolveThumbnail(url: string, host: string) {
  try {
    const noembed = await fetchJson(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
    );
    const image = pickImage(noembed);
    if (image) return image;
  } catch {
    // ignore
  }

  if (/youtube\.com|youtu\.be/i.test(host)) {
    try {
      const yt = await fetchJson(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      );
      const image = pickImage(yt);
      if (image) return image;
    } catch {
      // ignore
    }
  }

  if (/tiktok\.com/i.test(host)) {
    try {
      const tiktok = await fetchJson(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
      );
      const image = pickImage(tiktok);
      if (image) return image;
    } catch {
      // ignore
    }
  }

  if (/instagram\.com/i.test(host)) {
    try {
      const ig = await fetchJson(
        `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(url)}`,
      );
      const image = pickImage(ig);
      if (image) return image;
    } catch {
      // ignore
    }
  }

  return "";
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

  const thumbnail = await resolveThumbnail(url, parsed.hostname);
  if (!thumbnail) {
    return NextResponse.json({ error: "no image" }, { status: 404 });
  }

  try {
    const upstream = await fetch(thumbnail, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: `${parsed.origin}/`,
      },
      next: { revalidate: 3600 },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "image fetch failed" },
        { status: 502 },
      );
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const bytes = await upstream.arrayBuffer();

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "image fetch failed" }, { status: 502 });
  }
}
