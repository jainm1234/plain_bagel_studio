"use client";

import { useEffect, useState } from "react";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import {
  getFireCount,
  getReactorId,
  hasFired,
  toggleFire,
} from "@/lib/workbenchReactions";

type Props = {
  postId: string;
};

export default function WorkbenchFireReaction({ postId }: Props) {
  const { user, ready } = useWorkbenchAuth();
  const [active, setActive] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!ready) return;
    const reactorId = getReactorId(user?.id);
    setActive(hasFired(postId, reactorId));
    setCount(getFireCount(postId));
  }, [postId, ready, user?.id]);

  function onToggle() {
    if (!ready) return;
    const reactorId = getReactorId(user?.id);
    const next = toggleFire(postId, reactorId);
    setActive(next.active);
    setCount(next.count);
  }

  return (
    <button
      type="button"
      className={
        active
          ? "workbench-reaction workbench-reaction--fire is-active"
          : "workbench-reaction workbench-reaction--fire"
      }
      onClick={onToggle}
      aria-pressed={active}
      aria-label={
        active
          ? `Remove fire reaction, ${count} total`
          : `Add fire reaction, ${count} total`
      }
      disabled={!ready}
    >
      <span className="workbench-reaction-emoji" aria-hidden="true">
        🔥
      </span>
      <span className="workbench-reaction-count">{count}</span>
    </button>
  );
}
