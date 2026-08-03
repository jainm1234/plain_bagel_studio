import type { WorkbenchPostDraft } from "@/lib/workbenchPostEdits";
import { amazonSearchUrl } from "@/lib/reverseEngineer";

type DraftSeed = {
  postId: string;
  title: string;
  description: string;
  socialLink: string;
};

async function fetchText(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return "";
    return await response.text();
  } catch {
    return "";
  }
}

export async function loadProjectDraft(
  seed: DraftSeed,
): Promise<WorkbenchPostDraft | null> {
  if (seed.postId === "note-taker") {
    const [ino, py] = await Promise.all([
      fetchText("/projects/note-taker/notebook_recorder.ino"),
      fetchText("/projects/note-taker/recorder_ui.py"),
    ]);

    return {
      postId: "note-taker",
      projectName: seed.title || "note taker",
      lead: seed.description,
      postHtml: `<p>${seed.description}</p>`,
      socialLink: seed.socialLink,
      parts: [
        {
          id: "mat-1",
          name: "esp32-s3 sense",
          note: "with pdm mic",
          buyUrl: amazonSearchUrl("Seeed XIAO ESP32S3 Sense"),
          imageSrc: "/projects/note-taker/materials/esp32.png",
        },
        {
          id: "mat-2",
          name: "breadboard",
          buyUrl: amazonSearchUrl("solderless breadboard"),
          imageSrc: "/projects/note-taker/materials/breadboard.jpg",
        },
        {
          id: "mat-3",
          name: "jumper wires",
          note: "male-to-male",
          buyUrl: amazonSearchUrl("dupont jumper wires male to male"),
          imageSrc: "/projects/note-taker/materials/wires.jpg",
        },
        {
          id: "mat-4",
          name: "push button",
          note: "hold to record",
          buyUrl: amazonSearchUrl("tactile push button switch kit"),
          imageSrc: "/projects/note-taker/materials/button.jpg",
        },
        {
          id: "mat-5",
          name: "led",
          note: "rec indicator",
          buyUrl: amazonSearchUrl("5mm LED assortment kit"),
          imageSrc: "/projects/note-taker/materials/leds.jpg",
        },
        {
          id: "mat-6",
          name: "resistor",
          note: "~220Ω for led",
          buyUrl: amazonSearchUrl("220 ohm resistor assortment"),
          imageSrc: "/projects/note-taker/materials/resistors.png",
        },
        {
          id: "mat-7",
          name: "usb cable",
          note: "usb-c",
          buyUrl: amazonSearchUrl("USB C cable data"),
          imageSrc: "/projects/note-taker/materials/usb.png",
        },
      ],
      steps: [],
      schematics: [
        {
          id: "schematic-1",
          source: "custom",
          boardLabel: "esp32-s3 sense",
          buttonPin: "d02 (gpio 2)",
          ledPin: "d03 (gpio 3)",
          hasOnboardMic: true,
          pinMap: "",
          imageUrl: null,
        },
      ],
      files: [
        { path: "notebook_recorder.ino", content: ino },
        { path: "recorder_ui.py", content: py },
      ],
    };
  }

  // Generic editable shell for other owned posts (once content exists).
  if (!seed.postId) return null;
  return {
    postId: seed.postId,
    projectName: seed.title,
    lead: seed.description,
    postHtml: seed.description ? `<p>${seed.description}</p>` : "",
    socialLink: seed.socialLink,
    parts: [],
    steps: [],
    schematics: [],
    files: [],
  };
}
