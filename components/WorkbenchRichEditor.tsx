"use client";

import { useEffect, type ReactNode } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
};

const DownloadLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      download: {
        default: null,
        parseHTML: (element) => element.getAttribute("download"),
        renderHTML: (attributes) => {
          if (!attributes.download && attributes.download !== "") return {};
          return { download: attributes.download as string };
        },
      },
      target: {
        default: "_blank",
        parseHTML: (element) => element.getAttribute("target"),
        renderHTML: (attributes) => {
          if (attributes.download || attributes.download === "") return {};
          return { target: (attributes.target as string) || "_blank" };
        },
      },
    };
  },
});

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  title,
}: {
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      className={active ? "workbench-rte-btn is-active" : "workbench-rte-btn"}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      disabled={disabled}
      aria-pressed={active || false}
      aria-label={title}
      title={title}
    >
      {label}
    </button>
  );
}

function UndoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3.5 7.5H10a3.5 3.5 0 1 1 0 7H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        d="M6 4.5 3 7.5l3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M12.5 7.5H6a3.5 3.5 0 1 0 0 7h2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
      />
      <path
        d="M10 4.5 13 7.5l-3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export default function WorkbenchRichEditor({
  value,
  onChange,
  placeholder = "write your post…",
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        undoRedo: false,
      }),
      Underline,
      DownloadLink.configure({
        openOnClick: false,
        protocols: ["http", "https", "mailto", "tel", "data"],
        HTMLAttributes: {
          rel: "noopener noreferrer",
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value || "",
    onUpdate: ({ editor: next }) => {
      onChange(next.getHTML());
    },
    editorProps: {
      attributes: {
        class: "workbench-rte-content workbench-rte-content--project",
        spellcheck: "true",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="workbench-rte workbench-rte--loading" />;
  }

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const next = window.prompt("link url", previous || "https://");
    if (next === null) return;
    const href = next.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  return (
    <div className="workbench-rte">
      <div
        className="workbench-rte-toolbar"
        role="toolbar"
        aria-label="Formatting"
      >
        <ToolbarButton
          label={<UndoIcon />}
          title="Undo"
          disabled={!canUndo}
          onClick={() => onUndo?.()}
        />
        <ToolbarButton
          label={<RedoIcon />}
          title="Redo"
          disabled={!canRedo}
          onClick={() => onRedo?.()}
        />
        <span className="workbench-rte-sep" aria-hidden="true" />
        <ToolbarButton
          label="B"
          title="Bold"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="I"
          title="Italic"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="U"
          title="Underline"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <ToolbarButton
          label="S"
          title="Strikethrough"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <span className="workbench-rte-sep" aria-hidden="true" />
        <ToolbarButton
          label="H1"
          title="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          label="H2"
          title="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          label="H3"
          title="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <span className="workbench-rte-sep" aria-hidden="true" />
        <ToolbarButton
          label="• list"
          title="Bullet list"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="1. list"
          title="Numbered list"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="quote"
          title="Quote"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarButton
          label="code"
          title="Code block"
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <span className="workbench-rte-sep" aria-hidden="true" />
        <ToolbarButton
          label="link"
          title="Link"
          active={editor.isActive("link")}
          onClick={setLink}
        />
        <ToolbarButton
          label="clear"
          title="Clear formatting"
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().run()
          }
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function socialHostLabel(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("instagram")) return "instagram";
    if (host.includes("tiktok")) return "tiktok";
    if (host.includes("youtube") || host.includes("youtu.be")) return "youtube";
    if (host.includes("x.com") || host.includes("twitter")) return "x";
    return host;
  } catch {
    return "social";
  }
}

export function fileBasename(path: string) {
  return path.split("/").pop() || path;
}

export function buildProjectPostHtml(input: {
  social?: string;
  summary?: string;
}) {
  const summary = input.summary?.trim() || "";
  return summary ? `<p>${escapeHtml(summary)}</p>` : "<p></p>";
}

export function withSocialInPostHtml(html: string, _social: string) {
  // Social link is rendered outside the editor (note-taker format).
  return html.replace(
    /<p>\s*<a href=["'][^"']*["'][^>]*>\s*open on [^<]*<\/a>\s*<\/p>/gi,
    "",
  );
}
