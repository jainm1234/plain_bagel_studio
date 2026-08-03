import type { WorkbenchProject } from "@/components/WorkbenchFeed";
import type { WorkbenchPostDraft } from "@/lib/workbenchPostEdits";
import { postHref } from "@/lib/workbenchPostEdits";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export type WorkbenchPostRecord = {
  id: string;
  author_id: string;
  author_handle: string;
  project_name: string;
  lead: string;
  post_html: string;
  social_link: string;
  cover_image: string | null;
  parts: WorkbenchPostDraft["parts"];
  steps: WorkbenchPostDraft["steps"];
  schematics: WorkbenchPostDraft["schematics"];
  files: WorkbenchPostDraft["files"];
  created_at: string;
  updated_at: string;
};

export type WorkbenchPostInput = {
  postId?: string;
  projectName: string;
  lead: string;
  postHtml: string;
  socialLink: string;
  coverImage?: string | null;
  parts: WorkbenchPostDraft["parts"];
  steps: WorkbenchPostDraft["steps"];
  schematics: WorkbenchPostDraft["schematics"];
  files: WorkbenchPostDraft["files"];
  author: {
    id: string;
    handle: string;
  };
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function makePostId(projectName: string) {
  const base = slugify(projectName) || "project";
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

export function draftFromRecord(row: WorkbenchPostRecord): WorkbenchPostDraft {
  return {
    postId: row.id,
    projectName: row.project_name,
    lead: row.lead || "",
    postHtml: row.post_html || "",
    socialLink: row.social_link || "",
    coverImage: row.cover_image,
    parts: Array.isArray(row.parts) ? row.parts : [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    schematics: Array.isArray(row.schematics) ? row.schematics : [],
    files: Array.isArray(row.files) ? row.files : [],
  };
}

export function projectFromRecord(row: WorkbenchPostRecord): WorkbenchProject {
  return {
    title: row.project_name,
    href: postHref(row.id),
    image: row.cover_image || undefined,
    description: row.lead || "",
    socialLink: row.social_link || undefined,
    tags: [],
    author: {
      id: row.author_id,
      handle: row.author_handle,
    },
    updatedAt: row.updated_at.slice(0, 10),
  };
}

function rowFromInput(
  input: WorkbenchPostInput,
  id: string,
): Omit<WorkbenchPostRecord, "created_at" | "updated_at"> {
  return {
    id,
    author_id: input.author.id,
    author_handle: input.author.handle,
    project_name: input.projectName.trim() || "untitled project",
    lead: input.lead || "",
    post_html: input.postHtml || "",
    social_link: input.socialLink || "",
    cover_image: input.coverImage ?? null,
    parts: input.parts || [],
    steps: input.steps || [],
    schematics: input.schematics || [],
    files: input.files || [],
  };
}

export async function listPosts(): Promise<WorkbenchPostRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as WorkbenchPostRecord[];
}

export async function getPost(
  postId: string,
): Promise<WorkbenchPostRecord | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  return (data as WorkbenchPostRecord | null) ?? null;
}

export async function createPost(
  input: WorkbenchPostInput,
): Promise<WorkbenchPostRecord> {
  const supabase = getSupabaseAdmin();
  const id = input.postId?.trim() || makePostId(input.projectName);
  const row = rowFromInput(input, id);
  const { data, error } = await supabase
    .from("posts")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data as WorkbenchPostRecord;
}

export async function updatePost(
  postId: string,
  input: WorkbenchPostInput,
): Promise<WorkbenchPostRecord> {
  const supabase = getSupabaseAdmin();
  const row = {
    ...rowFromInput(input, postId),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("posts")
    .update(row)
    .eq("id", postId)
    .select("*")
    .single();
  if (error) throw error;
  return data as WorkbenchPostRecord;
}
