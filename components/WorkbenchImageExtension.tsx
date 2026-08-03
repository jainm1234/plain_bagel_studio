"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import { type FormEvent } from "react";

export type SetWorkbenchImageOptions = {
  src: string;
  alt?: string;
  width?: number | null;
  caption?: string | null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    image: {
      setImage: (options: SetWorkbenchImageOptions) => ReturnType;
      updateImage: (options: Partial<SetWorkbenchImageOptions>) => ReturnType;
    };
  }
}

const IMAGE_SIZES = [
  { id: "s", label: "S", width: 33 },
  { id: "m", label: "M", width: 66 },
  { id: "l", label: "L", width: 100 },
] as const;

function snapWidth(value: number) {
  let best = IMAGE_SIZES[IMAGE_SIZES.length - 1].width;
  let bestDist = Infinity;
  for (const size of IMAGE_SIZES) {
    const dist = Math.abs(size.width - value);
    if (dist < bestDist) {
      best = size.width;
      bestDist = dist;
    }
  }
  return best;
}

function WorkbenchImageView({
  node,
  updateAttributes,
  selected,
  editor,
}: NodeViewProps) {
  const width = snapWidth(Number(node.attrs.width) || 100);
  const caption = (node.attrs.caption as string) || "";

  function onCaptionInput(event: FormEvent<HTMLInputElement>) {
    updateAttributes({ caption: event.currentTarget.value });
  }

  return (
    <NodeViewWrapper
      as="figure"
      className={selected ? "workbench-figure is-selected" : "workbench-figure"}
      style={{ width: `${width}%` }}
      data-drag-handle
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) || ""}
        className="workbench-inline-image"
        draggable={false}
      />
      {editor.isEditable ? (
        <div
          className="workbench-figure-controls"
          contentEditable={false}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            className="workbench-figure-sizes"
            role="group"
            aria-label="Image size"
          >
            {IMAGE_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                className={
                  width === size.width
                    ? "workbench-figure-size is-active"
                    : "workbench-figure-size"
                }
                aria-pressed={width === size.width}
                onClick={() => updateAttributes({ width: size.width })}
              >
                {size.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="workbench-figure-caption-input"
            value={caption}
            placeholder="Add a caption…"
            onChange={onCaptionInput}
          />
        </div>
      ) : caption.trim() ? (
        <figcaption className="workbench-figure-caption">
          {caption.trim()}
        </figcaption>
      ) : null}
    </NodeViewWrapper>
  );
}

function parseWidth(value: string | null) {
  if (!value) return null;
  const percent = value.match(/([\d.]+)\s*%/);
  if (percent) return snapWidth(Number(percent[1]));
  const px = value.match(/([\d.]+)\s*px/i);
  if (px) {
    const n = Number(px[1]);
    if (!Number.isFinite(n) || n <= 0) return null;
    return snapWidth(Math.min(100, (n / 640) * 100));
  }
  const bare = Number(value);
  return Number.isFinite(bare) ? snapWidth(bare) : null;
}

/** Block image with S/M/L width and optional caption. */
export const WorkbenchImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      width: {
        default: 100,
        parseHTML: (element) => {
          const fromData = element.getAttribute("data-width");
          if (fromData) return parseWidth(fromData) ?? 100;
          const styleWidth =
            element.getAttribute("style")?.match(/width:\s*([^;]+)/i)?.[1] ||
            null;
          if (styleWidth) return parseWidth(styleWidth) ?? 100;
          if (element.tagName === "FIGURE") {
            const img = element.querySelector("img");
            const imgStyle =
              img?.getAttribute("style")?.match(/width:\s*([^;]+)/i)?.[1] ||
              null;
            if (imgStyle) return parseWidth(imgStyle) ?? 100;
          }
          return 100;
        },
        renderHTML: (attributes) => {
          const width = snapWidth(Number(attributes.width) || 100);
          return {
            "data-width": String(width),
            style: `width: ${width}%`,
          };
        },
      },
      caption: {
        default: "",
        parseHTML: (element) => {
          if (element.tagName === "FIGURE") {
            return (
              element.querySelector("figcaption")?.textContent?.trim() || ""
            );
          }
          return (
            element.getAttribute("data-caption") ||
            element.getAttribute("title") ||
            ""
          );
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure.workbench-figure",
        getAttrs: (node) => {
          if (!(node instanceof HTMLElement)) return false;
          const img = node.querySelector("img");
          const src = img?.getAttribute("src");
          if (!src) return false;
          return {
            src,
            alt: img?.getAttribute("alt") || null,
          };
        },
      },
      {
        tag: "img[src]",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const captionText = String(node.attrs.caption || "").trim();
    const { alt, src, ...rest } = HTMLAttributes as Record<string, unknown>;
    const figureAttrs = mergeAttributes(rest, {
      class: "workbench-figure",
    });
    const img = [
      "img",
      mergeAttributes({
        src: src ?? node.attrs.src,
        alt: (alt as string) || node.attrs.alt || null,
        class: "workbench-inline-image",
      }),
    ] as const;
    if (captionText) {
      return [
        "figure",
        figureAttrs,
        img,
        ["figcaption", { class: "workbench-figure-caption" }, captionText],
      ];
    }
    return ["figure", figureAttrs, img];
  },

  addNodeView() {
    return ReactNodeViewRenderer(WorkbenchImageView);
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              alt: options.alt || null,
              width: snapWidth(options.width ?? 100),
              caption: options.caption || "",
            },
          }),
      updateImage:
        (options) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, {
            ...options,
            ...(options.width != null
              ? { width: snapWidth(options.width) }
              : {}),
          }),
    };
  },
});
