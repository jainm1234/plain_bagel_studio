import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";
import type { BuildProgress } from "@/lib/workbenchBuildGuide";

const EMPTY: BuildProgress = { materials: [], steps: [] };

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (item): item is string => typeof item === "string" && Boolean(item.trim()),
      ),
    ),
  ];
}

export async function getBuildProgress(
  postId: string,
  userId: string,
): Promise<BuildProgress> {
  if (!isSupabaseConfigured()) return EMPTY;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("build_progress")
    .select("materials, steps")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.code === "PGRST205"
        ? "Progress table missing — run the build_progress SQL in Supabase."
        : error.message,
    );
  }

  return {
    materials: asIdList(data?.materials),
    steps: asIdList(data?.steps),
  };
}

export async function saveBuildProgressRemote(
  postId: string,
  userId: string,
  progress: BuildProgress,
): Promise<BuildProgress> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  const supabase = getSupabaseAdmin();
  const next = {
    materials: asIdList(progress.materials),
    steps: asIdList(progress.steps),
  };
  const { error } = await supabase.from("build_progress").upsert(
    {
      post_id: postId,
      user_id: userId,
      materials: next.materials,
      steps: next.steps,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "post_id,user_id" },
  );

  if (error) {
    throw new Error(
      error.code === "PGRST205"
        ? "Progress table missing — run the build_progress SQL in Supabase."
        : error.message,
    );
  }

  return next;
}
