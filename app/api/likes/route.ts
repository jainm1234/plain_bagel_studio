import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getLikeState, toggleLike } from "@/lib/workbenchLikesDb";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      configured: false,
      count: 0,
      liked: false,
    });
  }

  const { searchParams } = request.nextUrl;
  const postId = searchParams.get("postId")?.trim() || "";
  const reactorId =
    searchParams.get("reactorId")?.trim() ||
    (await auth()).userId ||
    "";

  if (!postId) {
    return NextResponse.json({ error: "missing postId" }, { status: 400 });
  }

  try {
    const state = await getLikeState(postId, reactorId || null);
    return NextResponse.json({ configured: true, ...state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to load likes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as {
      postId?: string;
      reactorId?: string;
    };
    const postId = body.postId?.trim() || "";
    const { userId } = await auth();
    const reactorId = (userId || body.reactorId || "").trim();

    if (!postId) {
      return NextResponse.json({ error: "missing postId" }, { status: 400 });
    }
    if (!reactorId) {
      return NextResponse.json(
        { error: "sign in required to like" },
        { status: 401 },
      );
    }

    const state = await toggleLike(postId, reactorId);
    return NextResponse.json({ configured: true, ...state });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to toggle like";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
