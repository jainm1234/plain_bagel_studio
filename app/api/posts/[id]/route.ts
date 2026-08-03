import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  draftFromRecord,
  getPost,
  projectFromRecord,
  updatePost,
  type WorkbenchPostInput,
} from "@/lib/workbenchPostsDb";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function usernameFromEmail(email: string | undefined) {
  if (!email) return "";
  const local = email.split("@")[0]?.trim() || "";
  return local.toLowerCase();
}

async function resolveAuthor() {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress;
  const handle =
    usernameFromEmail(email) ||
    user?.username ||
    user?.firstName?.toLowerCase() ||
    "user";
  return { id: userId, handle };
}

export async function GET(_request: NextRequest, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const { id } = await params;
  try {
    const row = await getPost(decodeURIComponent(id));
    if (!row) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      post: projectFromRecord(row),
      draft: draftFromRecord(row),
      author: { id: row.author_id, handle: row.author_handle },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to load post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 },
    );
  }

  const author = await resolveAuthor();
  if (!author) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const postId = decodeURIComponent(id);

  try {
    const existing = await getPost(postId);
    if (!existing) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    if (existing.author_id !== author.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as Partial<WorkbenchPostInput>;
    const input: WorkbenchPostInput = {
      projectName: body.projectName || existing.project_name,
      lead: body.lead ?? existing.lead,
      postHtml: body.postHtml ?? existing.post_html,
      socialLink: body.socialLink ?? existing.social_link,
      coverImage:
        body.coverImage !== undefined ? body.coverImage : existing.cover_image,
      parts: body.parts || existing.parts,
      steps: body.steps || existing.steps,
      schematics: body.schematics || existing.schematics,
      files: body.files || existing.files,
      author: {
        id: existing.author_id,
        handle: author.handle || existing.author_handle,
      },
    };

    const row = await updatePost(postId, input);
    return NextResponse.json({
      post: projectFromRecord(row),
      draft: draftFromRecord(row),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "failed to update post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
