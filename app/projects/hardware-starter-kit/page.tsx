import type { Metadata } from "next";
import Image from "next/image";
import { Caveat } from "next/font/google";
import localFont from "next/font/local";
import Header from "@/components/Header";
import SuggestionBox from "@/components/SuggestionBox";

const permanentMarker = localFont({
  src: "../../fonts/permanent-marker/PermanentMarker-Regular.ttf",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: "700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "hardware starter kit — plain bagel studios",
};

const toc = [
  { label: "buy", href: "#buy" },
  { label: "materials", href: "#materials" },
  { label: "projects", href: "#projects" },
  { label: "tips", href: "#tips" },
  { label: "note from designer", href: "#note-from-designer" },
];

const projects: {
  name: string;
  comingSoon: boolean;
  href?: string;
}[] = [
  { name: "fairy garden", comingSoon: false },
  {
    name: "note taker pt1",
    comingSoon: false,
    href: "/projects/note-taker",
  },
  { name: "phone lock box", comingSoon: true },
  { name: "cyber", comingSoon: true },
];

const materialFiles = [
  "esp32.png",
  "breadboard.jpg",
  "leds.jpg",
  "resistors.png",
  "button.jpg",
  "servo.jpg",
  "usb.png",
] as const;

const layouts: Record<string, string> = {
  esp32: "label-right",
  breadboard: "label-below",
  leds: "label-left",
  resistors: "label-above",
  button: "label-below",
  servo: "label-below",
  usb: "label-left",
};

const materials = materialFiles.map((file) => {
  const name = file.replace(/\.[^.]+$/, "");
  return {
    name,
    src: `/projects/hardware-starter-kit/materials/${file}`,
    alt: name,
    layout: layouts[name],
    compact: name === "resistors" || name === "button",
    note: name === "usb" ? "(not included in kit)" : undefined,
  };
});

const byName = Object.fromEntries(materials.map((item) => [item.name, item]));

function MaterialCard({
  item,
  className = "",
}: {
  item: (typeof materials)[number];
  className?: string;
}) {
  return (
    <figure
      className={`kit-material kit-material--${item.layout} kit-material--${item.name}${item.compact ? " kit-material--compact" : ""}${className ? ` ${className}` : ""}`}
    >
      <div className="kit-material-image">
        <Image
          src={item.src}
          alt={item.alt}
          width={800}
          height={1000}
          className="kit-material-img"
        />
      </div>
      <div className="kit-material-caption">
        <figcaption className={`kit-material-label ${caveat.className}`}>
          {item.name}
        </figcaption>
        {item.note ? (
          <span className={`kit-material-note ${caveat.className}`}>
            {item.note}
          </span>
        ) : null}
      </div>
    </figure>
  );
}

export default function HardwareStarterKitPage() {
  return (
    <main className="publication">
      <Header />
      <div className="kit-hero">
        <div className="kit-hero-inner">
          <h1 className={`kit-title ${permanentMarker.className}`}>
            <span className="kit-title-hardware">hardware</span>
            <span className="kit-title-rest">starter kit</span>
          </h1>
          <nav
            className={`kit-toc ${caveat.className}`}
            aria-label="Table of contents"
          >
            {toc.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <section id="buy" className="kit-buy kit-buy--coming-soon">
            <div className="kit-buy-image">
              <Image
                src="/projects/hardware-starter-kit/materials/holder.png"
                alt="Hardware starter kit"
                width={800}
                height={1000}
                className="kit-buy-img"
              />
            </div>
            <div className="kit-buy-copy">
              <h2>starter kit</h2>
              <p>everything you need for your first project</p>
              <p className="kit-buy-price">$34</p>
              <span className="kit-buy-button kit-buy-button--soon">
                coming soon
              </span>
            </div>
          </section>

          <div className="kit-included-arrow" aria-hidden="true">
            <p className={`kit-included-label ${caveat.className}`}>
              what is included
            </p>
            <svg
              className="kit-included-svg"
              viewBox="0 0 80 140"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M38 4 C 42 28, 34 52, 41 74 C 46 92, 36 110, 40 128"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M28 112 C 34 120, 38 126, 40 128 C 36 118, 44 112, 52 108"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <section id="materials" className="kit-section">
            <div className="kit-materials-wrap">
              <MaterialCard item={byName.esp32} />
              <MaterialCard item={byName.breadboard} />
              <MaterialCard item={byName.resistors} />
              <h2 className={`kit-materials-heading ${permanentMarker.className}`}>
                materials
              </h2>
              <MaterialCard item={byName.button} />
              <MaterialCard item={byName.leds} />
              <MaterialCard item={byName.usb} />
              <MaterialCard item={byName.servo} />
            </div>
          </section>

          <section id="projects" className="kit-projects">
            <h2 className={`kit-projects-heading ${permanentMarker.className}`}>
              projects
            </h2>
            <ul className={`kit-projects-list ${caveat.className}`}>
              {projects.map((project) => (
                <li
                  key={project.name}
                  className={
                    project.comingSoon ? "kit-project--coming-soon" : undefined
                  }
                >
                  {project.href ? (
                    <a href={project.href}>{project.name}</a>
                  ) : (
                    project.name
                  )}
                  {project.comingSoon ? (
                    <span className="kit-project-soon"> coming soon</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <SuggestionBox />
          </section>

          <section id="note-from-designer" className="kit-note">
            <h2 className={`kit-note-heading ${permanentMarker.className}`}>
              note from designer
            </h2>
            <p className={caveat.className}>
              building things with my hands changed my life, and i hope it does
              the same for you
            </p>
            <p className={`kit-note-signoff ${caveat.className}`}>xo malvika</p>
          </section>
        </div>
      </div>
    </main>
  );
}
