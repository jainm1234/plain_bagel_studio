import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  getBuildProgress,
  saveBuildProgressRemote,
} from "@/lib/workbenchProgressDb";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const postId = request.nextUrl.searchParams.get("postId")?.trim() || "";
  if (!postId) {
    return NextResponse.json({ error: "missing postId" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      materials: [],
      steps: [],
    });
  }

  try {
    const progress = await getBuildProgress(postId, userId);
    return NextResponse.json({ configured: true, ...progress });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to load progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      postId?: string;
      materials?: string[];
      steps?: string[];
    };
    const postId = body.postId?.trim() || "";
    if (!postId) {
      return NextResponse.json({ error: "missing postId" }, { status: 400 });
    }

    const progress = await saveBuildProgressRemote(postId, userId, {
      materials: body.materials || [],
      steps: body.steps || [],
    });
    return NextResponse.json({ configured: true, ...progress });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to save progress";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
