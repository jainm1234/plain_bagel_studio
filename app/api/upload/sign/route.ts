import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";

const BUCKET = "post-media";

function safeExt(contentType: string, filename?: string) {
  if (filename && filename.includes(".")) {
    return filename.split(".").pop()!.toLowerCase().slice(0, 8);
  }
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  return "bin";
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      contentType?: string;
      filename?: string;
      folder?: string;
    };
    const contentType = (body.contentType || "application/octet-stream").trim();
    const folder = (body.folder || "uploads").replace(/[^a-z0-9/_-]/gi, "");
    const ext = safeExt(contentType, body.filename);
    const path = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const supabase = getSupabaseAdmin();

    // Ensure bucket exists (idempotent).
    const buckets = await supabase.storage.listBuckets();
    const hasBucket = (buckets.data || []).some((b) => b.name === BUCKET);
    if (!hasBucket) {
      const created = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: 50 * 1024 * 1024,
      });
      if (created.error && !/already exists/i.test(created.error.message)) {
        throw new Error(created.error.message);
      }
    }

    const signed = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (signed.error || !signed.data) {
      throw new Error(signed.error?.message || "Could not create upload URL");
    }

    const { data: publicData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      path,
      token: signed.data.token,
      signedUrl: signed.data.signedUrl,
      publicUrl: publicData.publicUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to prepare upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
