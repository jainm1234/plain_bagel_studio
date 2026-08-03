import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

export type LikeState = {
  count: number;
  liked: boolean;
};

export async function getLikeState(
  postId: string,
  reactorId?: string | null,
): Promise<LikeState> {
  if (!isSupabaseConfigured()) return { count: 0, liked: false };
  const supabase = getSupabaseAdmin();

  const { count, error: countError } = await supabase
    .from("post_likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  if (countError) {
    throw new Error(
      countError.code === "PGRST205"
        ? "Likes table missing — run the post_likes SQL in Supabase."
        : countError.message,
    );
  }

  let liked = false;
  if (reactorId) {
    const { data, error } = await supabase
      .from("post_likes")
      .select("reactor_id")
      .eq("post_id", postId)
      .eq("reactor_id", reactorId)
      .maybeSingle();
    if (error) throw error;
    liked = Boolean(data);
  }

  return { count: count ?? 0, liked };
}

export async function getLikeStates(
  postIds: string[],
  reactorId?: string | null,
): Promise<Record<string, LikeState>> {
  const unique = [...new Set(postIds.filter(Boolean))];
  const result: Record<string, LikeState> = {};
  for (const id of unique) {
    result[id] = { count: 0, liked: false };
  }
  if (!unique.length || !isSupabaseConfigured()) return result;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("post_likes")
    .select("post_id, reactor_id")
    .in("post_id", unique);

  if (error) throw error;

  for (const row of data || []) {
    const id = row.post_id as string;
    if (!result[id]) result[id] = { count: 0, liked: false };
    result[id].count += 1;
    if (reactorId && row.reactor_id === reactorId) {
      result[id].liked = true;
    }
  }

  return result;
}

export async function toggleLike(
  postId: string,
  reactorId: string,
): Promise<LikeState> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
  const supabase = getSupabaseAdmin();

  const { data: existing, error: existingError } = await supabase
    .from("post_likes")
    .select("reactor_id")
    .eq("post_id", postId)
    .eq("reactor_id", reactorId)
    .maybeSingle();

  if (existingError) {
    throw new Error(
      existingError.code === "PGRST205"
        ? "Likes table missing — run the post_likes SQL in Supabase."
        : existingError.message,
    );
  }

  if (existing) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("reactor_id", reactorId);
    if (error) throw new Error(error.message);
  } else {
    // One like per person: clear any other post they liked first.
    const { error: clearError } = await supabase
      .from("post_likes")
      .delete()
      .eq("reactor_id", reactorId);
    if (clearError) throw new Error(clearError.message);

    const { error } = await supabase.from("post_likes").insert({
      post_id: postId,
      reactor_id: reactorId,
    });
    if (error) {
      throw new Error(
        error.code === "PGRST205"
          ? "Likes table missing — run the post_likes SQL in Supabase."
          : error.message,
      );
    }
  }

  return getLikeState(postId, reactorId);
}
