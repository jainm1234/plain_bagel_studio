"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import WorkbenchAccount from "@/components/WorkbenchAccount";
import WorkbenchProjectCard from "@/components/WorkbenchProjectCard";
import { openWorkbenchSubmit } from "@/lib/workbenchPostEdits";
import {
  WORKBENCH_SEARCH_SUGGESTIONS,
  projectMatchesWorkbenchQuery,
} from "@/lib/workbenchProjects";

export type WorkbenchProject = {
  title: string;
  href: string;
  image?: string;
  description: string;
  tags: string[];
  comingSoon?: boolean;
  updatedAt: string;
  socialLink?: string;
  author?: {
    id: string;
    handle: string;
  };
};

type ViewMode = "all" | "projects" | "coming-soon";
type SortMode = "recent" | "random" | "alpha";

const VIEW_OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "all", label: "all" },
  { id: "projects", label: "projects" },
  { id: "coming-soon", label: "coming soon" },
];

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: "recent", label: "recently updated" },
  { id: "random", label: "random" },
  { id: "alpha", label: "a–z" },
];

type Props = {
  projects: WorkbenchProject[];
};

export default function WorkbenchFeed({ projects }: Props) {
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [view, setView] = useState<ViewMode>("all");
  const [viewOpen, setViewOpen] = useState(false);
  const [sort, setSort] = useState<SortMode>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const [randomSeed, setRandomSeed] = useState(0);
  const viewRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!viewRef.current?.contains(target)) setViewOpen(false);
      if (!sortRef.current?.contains(target)) setSortOpen(false);
      if (!searchRef.current?.contains(target)) setSearchFocused(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const viewLabel =
    VIEW_OPTIONS.find((option) => option.id === view)?.label ?? view;
  const sortLabel =
    SORT_OPTIONS.find((option) => option.id === sort)?.label ?? sort;

  const suggestionMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...WORKBENCH_SEARCH_SUGGESTIONS];
    return WORKBENCH_SEARCH_SUGGESTIONS.filter(
      (item) =>
        item.label.includes(q) ||
        item.query.includes(q) ||
        q.split(/\s+/).some((token) => token && item.label.includes(token)),
    );
  }, [query]);

  const showSuggestions =
    searchFocused && suggestionMatches.length > 0 && query.trim().length < 40;

  const filtered = useMemo(() => {
    let next = projects.filter((project) => {
      if (view === "projects" && project.comingSoon) return false;
      if (view === "coming-soon" && !project.comingSoon) return false;
      return projectMatchesWorkbenchQuery(project, query);
    });

    if (sort === "alpha") {
      next = [...next].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "recent") {
      next = [...next].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    } else {
      next = [...next].sort((a, b) => {
        const ha = hashKey(`${randomSeed}:${a.title}`);
        const hb = hashKey(`${randomSeed}:${b.title}`);
        return ha - hb;
      });
    }

    return next;
  }, [projects, query, view, sort, randomSeed]);

  function applySuggestion(label: string) {
    setQuery(label);
    setSearchFocused(false);
  }

  return (
    <>
      <header className="workbench-topbar">
        <div className="workbench-topbar-actions">
          <button
            type="button"
            className="workbench-submit-link"
            onClick={() => openWorkbenchSubmit()}
          >
            submit a project <span aria-hidden="true">+</span>
          </button>
          <WorkbenchAccount />
        </div>
      </header>

      <div className="workbench">
        <div className="workbench-brand">
          <p className="workbench-brand-title">work bench</p>
          <p className="workbench-tagline">
            document and share hardware projects
          </p>
        </div>

        <div className="workbench-search-wrap" ref={searchRef}>
          <input
            className="workbench-search"
            type="search"
            placeholder="Search work bench"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            aria-label="Search work bench"
            aria-expanded={showSuggestions}
            aria-controls="workbench-search-suggestions"
            autoComplete="off"
          />
          {showSuggestions ? (
            <div
              id="workbench-search-suggestions"
              className="workbench-search-suggestions"
              role="listbox"
              aria-label="Search suggestions"
            >
              <p className="workbench-search-suggestions-label">try asking</p>
              {suggestionMatches.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="option"
                  className="workbench-search-suggestion"
                  onClick={() => applySuggestion(item.label)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="workbench-filters">
          <div className="workbench-dd" ref={viewRef}>
            <button
              type="button"
              className={
                viewOpen ? "workbench-dd-trigger is-open" : "workbench-dd-trigger"
              }
              aria-expanded={viewOpen}
              aria-haspopup="listbox"
              onClick={() => {
                setViewOpen((open) => !open);
                setSortOpen(false);
              }}
            >
              <span className="workbench-dd-key">view</span>
              <span className="workbench-dd-value">{viewLabel}</span>
              <span className="workbench-dd-caret" aria-hidden="true" />
            </button>
            {viewOpen ? (
              <div className="workbench-dd-menu" role="listbox" aria-label="View">
                {VIEW_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={view === option.id}
                    className={
                      view === option.id
                        ? "workbench-dd-option is-active"
                        : "workbench-dd-option"
                    }
                    onClick={() => {
                      setView(option.id);
                      setViewOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="workbench-dd" ref={sortRef}>
            <button
              type="button"
              className={
                sortOpen ? "workbench-dd-trigger is-open" : "workbench-dd-trigger"
              }
              aria-expanded={sortOpen}
              aria-haspopup="listbox"
              onClick={() => {
                setSortOpen((open) => !open);
                setViewOpen(false);
              }}
            >
              <span className="workbench-dd-key">sort</span>
              <span className="workbench-dd-value">{sortLabel}</span>
              <span className="workbench-dd-caret" aria-hidden="true" />
            </button>
            {sortOpen ? (
              <div className="workbench-dd-menu" role="listbox" aria-label="Sort">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={sort === option.id}
                    className={
                      sort === option.id
                        ? "workbench-dd-option is-active"
                        : "workbench-dd-option"
                    }
                    onClick={() => {
                      setSort(option.id);
                      if (option.id === "random") {
                        setRandomSeed((seed) => seed + 1);
                      }
                      setSortOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <section className="workbench-grid" aria-label="Projects">
          {filtered.length > 0 ? (
            filtered.map((project) => (
              <WorkbenchProjectCard key={project.title} {...project} />
            ))
          ) : (
            <p className="workbench-empty">no projects match</p>
          )}
        </section>
      </div>
    </>
  );
}

function hashKey(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
