import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { resolveWorkbenchAuthor } from "@/lib/workbenchAuthor";
import {
  createPost,
  listPosts,
  projectFromRecord,
  type WorkbenchPostInput,
} from "@/lib/workbenchPostsDb";

export const runtime = "nodejs";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ posts: [], configured: false });
  }

  try {
    const rows = await listPosts();
    return NextResponse.json({
      configured: true,
      posts: rows.map(projectFromRecord),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to list posts";
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

  const author = await resolveWorkbenchAuthor();
  if (!author) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Partial<WorkbenchPostInput>;
    const input: WorkbenchPostInput = {
      postId: body.postId,
      projectName: body.projectName || "untitled project",
      lead: body.lead || "",
      postHtml: body.postHtml || "",
      socialLink: body.socialLink || "",
      coverImage: body.coverImage ?? null,
      parts: body.parts || [],
      steps: body.steps || [],
      schematics: body.schematics || [],
      files: body.files || [],
      author,
    };
    const row = await createPost(input);
    return NextResponse.json({
      post: projectFromRecord(row),
      draft: row,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to create post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
