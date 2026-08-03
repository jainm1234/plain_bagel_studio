"use client";

import { useEffect, useState } from "react";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import {
  fetchLikeState,
  getReactorId,
  toggleLikeRemote,
} from "@/lib/workbenchReactions";

type Props = {
  postId: string;
};

const LIKES_CHANGED = "workbench-likes-changed";

export default function WorkbenchFireReaction({ postId }: Props) {
  const { user, ready, openLogin } = useWorkbenchAuth();
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !postId) return;
    const reactorId = getReactorId(user?.id);
    let cancelled = false;

    function refresh() {
      fetchLikeState(postId, reactorId).then((state) => {
        if (cancelled) return;
        setCount(state.count);
        setLiked(state.liked);
      });
    }

    refresh();
    function onChanged() {
      refresh();
    }
    window.addEventListener(LIKES_CHANGED, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(LIKES_CHANGED, onChanged);
    };
  }, [postId, ready, user?.id]);

  async function onToggle() {
    if (!ready || busy) return;
    if (!user) {
      openLogin("log in to like this post");
      return;
    }
    setBusy(true);
    try {
      const next = await toggleLikeRemote(postId, user.id);
      setLiked(next.liked);
      setCount(next.count);
      window.dispatchEvent(new Event(LIKES_CHANGED));
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not update like",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={
        liked
          ? "workbench-reaction workbench-reaction--fire is-active"
          : "workbench-reaction workbench-reaction--fire"
      }
      onClick={() => void onToggle()}
      aria-pressed={liked}
      aria-label={
        liked
          ? `Remove like, ${count} total`
          : `Add like, ${count} total`
      }
      disabled={!ready || busy}
    >
      <span className="workbench-reaction-emoji" aria-hidden="true">
        🔥
      </span>
      <span className="workbench-reaction-count">{count}</span>
    </button>
  );
}
