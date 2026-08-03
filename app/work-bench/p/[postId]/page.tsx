import type { Metadata } from "next";
import { notFound } from "next/navigation";
import WorkbenchProjectView from "@/components/WorkbenchProjectView";
import { isSupabaseConfigured } from "@/lib/supabase";
import { draftFromRecord, getPost } from "@/lib/workbenchPostsDb";

type Props = {
  params: Promise<{ postId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { postId } = await params;
  const row = await getPost(decodeURIComponent(postId)).catch(() => null);
  return {
    title: row?.project_name
      ? `${row.project_name} — work bench`
      : "project — work bench",
  };
}

export default async function WorkbenchPostPage({ params }: Props) {
  if (!isSupabaseConfigured()) notFound();

  const { postId } = await params;
  const row = await getPost(decodeURIComponent(postId)).catch(() => null);
  if (!row) notFound();

  return (
    <WorkbenchProjectView
      author={{ id: row.author_id, handle: row.author_handle }}
      draft={draftFromRecord(row)}
      useLocalEdits
    />
  );
}
