"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import WorkbenchAccount from "@/components/WorkbenchAccount";
import WorkbenchProjectCard from "@/components/WorkbenchProjectCard";
import type { WorkbenchProject } from "@/components/WorkbenchFeed";
import { useWorkbenchAuth } from "@/components/WorkbenchAuth";
import {
  getProjectsByAuthor,
  getPublicProfile,
} from "@/lib/workbenchProjects";

export default function WorkbenchProfilePage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { user, ready, updateProfile, signOut } = useWorkbenchAuth();
  const isSelf = ready && !!user && user.id === id;

  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);
  const [dbPosts, setDbPosts] = useState<WorkbenchProject[]>([]);

  const publicProfile = useMemo(() => getPublicProfile(id), [id]);
  const seededPosts = useMemo(() => getProjectsByAuthor(id), [id]);
  const posts = useMemo(() => {
    const seen = new Set(seededPosts.map((project) => project.href));
    return [
      ...seededPosts,
      ...dbPosts.filter((project) => !seen.has(project.href)),
    ];
  }, [seededPosts, dbPosts]);

  const profileHandle = isSelf
    ? user?.handle
    : publicProfile?.handle || dbPosts[0]?.author?.handle;

  useEffect(() => {
    if (!user || !isSelf) return;
    setHandle(user.handle);
    setDisplayName(user.displayName);
  }, [user, isSelf]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/posts")
      .then((response) => response.json())
      .then((data: { posts?: WorkbenchProject[] }) => {
        if (cancelled) return;
        const mine = (data.posts || []).filter(
          (project) => project.author?.id === id,
        );
        setDbPosts(mine);
      })
      .catch(() => {
        if (!cancelled) setDbPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  function onSave(event: FormEvent) {
    event.preventDefault();
    updateProfile({ handle, displayName });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  }

  return (
    <main className="workbench-site">
      <div className="workbench-topbar">
        <Link href="/work-bench" className="workbench-back">
          ← back
        </Link>
        <div className="workbench-topbar-actions">
          <WorkbenchAccount />
        </div>
      </div>

      <div className="workbench workbench--profile">
        <header className="workbench-profile-head">
          <h1 className="workbench-project-title">
            {profileHandle || "profile"}
          </h1>
        </header>

        {!ready ? (
          <p className="workbench-project-copy">loading…</p>
        ) : isSelf && user ? (
          <form className="workbench-profile-form" onSubmit={onSave}>
            <label className="workbench-flow-label" htmlFor="display-name">
              name
            </label>
            <input
              id="display-name"
              className="workbench-submit-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />

            <label className="workbench-flow-label" htmlFor="handle">
              username
            </label>
            <input
              id="handle"
              className="workbench-submit-input"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
            />

            {user.email ? (
              <p className="workbench-project-copy">{user.email}</p>
            ) : null}

            <div className="workbench-flow-actions">
              <button className="workbench-submit-button" type="submit">
                {saved ? "saved" : "save profile"}
              </button>
              <button
                className="workbench-submit-button workbench-submit-button--ghost"
                type="button"
                onClick={signOut}
              >
                log out
              </button>
            </div>
          </form>
        ) : null}

        <section className="workbench-profile-posts" aria-label="Posts">
          <h2 className="workbench-project-heading">
            posts
            {posts.length > 0 ? (
              <span className="workbench-profile-count"> · {posts.length}</span>
            ) : null}
          </h2>

          {posts.length > 0 ? (
            <div className="workbench-grid">
              {posts.map((project) => (
                <WorkbenchProjectCard key={project.href} {...project} />
              ))}
            </div>
          ) : (
            <p className="workbench-empty">no posts yet</p>
          )}
        </section>
      </div>
    </main>
  );
}
