import type { Metadata } from "next";
import fs from "fs";
import path from "path";
import WorkbenchProjectView from "@/components/WorkbenchProjectView";
import { amazonSearchUrl } from "@/lib/reverseEngineer";
import type { WorkbenchPostDraft } from "@/lib/workbenchPostEdits";

export const metadata: Metadata = {
  title: "note taker — work bench",
};

const scriptsDir = path.join(process.cwd(), "public/projects/note-taker");

const REEL_URL = "https://www.instagram.com/p/DaA2b_IRjB3/";

const LEAD =
  "a hold-to-talk notebook that lives on an esp32. press the button, speak your thought, let go. recordings sync over bluetooth (or usb) into a tiny web app that transcribes them for you.";

const materials = [
  {
    name: "esp32-s3 sense",
    note: "onboard pdm mic",
    buy: amazonSearchUrl("Seeed XIAO ESP32S3 Sense"),
  },
  {
    name: "breadboard + jumper wires",
    note: "male-to-male",
    buy: amazonSearchUrl("solderless breadboard jumper wire kit"),
  },
  {
    name: "push button",
    note: "hold to record",
    buy: amazonSearchUrl("tactile push button switch kit"),
  },
  {
    name: "led + 220Ω resistor",
    note: "rec indicator",
    buy: amazonSearchUrl("5mm LED 220 ohm resistor kit"),
  },
  {
    name: "usb-c cable",
    buy: amazonSearchUrl("USB C cable data"),
  },
];

const steps = [
  {
    title: "gather your parts",
    details: [
      "check off the materials list: esp32-s3 sense, breadboard + jumper wires, push button, led + 220Ω resistor, and usb-c cable.",
      "you also need a computer with python 3 and the arduino ide.",
    ],
  },
  {
    title: "seat the board",
    details: [
      "press the esp32-s3 sense into the breadboard. leave room beside it for the button and led. the mic is onboard — no extra wiring.",
    ],
  },
  {
    title: "wire the button",
    details: [
      "use jumper wires: one side of the button to d02 (gpio 2) on the esp32, the other side to gnd. hold = record.",
    ],
  },
  {
    title: "wire the led",
    details: [
      "d03 (gpio 3) → resistor → long led leg. short led leg → gnd. the led lights while recording.",
    ],
  },
  {
    title: "flash the firmware",
    details: [
      "download notebook_recorder.ino, open it in arduino ide, install the espressif esp32 board package, then plug in the usb-c cable.",
      "pick your esp32-s3 board and port, upload, and set serial monitor to 115200. you should see “ready — hold d02 to record.”",
    ],
  },
  {
    title: "run the companion app",
    details: [
      "download recorder_ui.py, then: pip install flask pyserial openai-whisper bleak && python recorder_ui.py",
      "a browser should open at http://localhost:5000.",
    ],
  },
  {
    title: "record a note",
    details: [
      "hold the button, speak, let go. the led stays on while you hold. the clip syncs over bluetooth, transcribes, and saves to ~/desktop/recordings.",
      "if bluetooth fails, plug in usb and click “usb sync.”",
    ],
  },
];

function buildNoteTakerDraft(): WorkbenchPostDraft {
  const ino = fs.readFileSync(
    path.join(scriptsDir, "notebook_recorder.ino"),
    "utf8",
  );
  const py = fs.readFileSync(path.join(scriptsDir, "recorder_ui.py"), "utf8");

  return {
    postId: "note-taker",
    projectName: "note taker",
    lead: LEAD,
    postHtml: `<p>${LEAD}</p>`,
    socialLink: REEL_URL,
    coverImage: "/projects/note-taker/cover.jpg",
    parts: materials.map((item, index) => ({
      id: `mat-${index + 1}`,
      name: item.name,
      note: "note" in item ? item.note : undefined,
      buyUrl: item.buy,
    })),
    steps: steps.map((step, index) => ({
      id: `step-${index + 1}`,
      title: step.title,
      details: step.details,
    })),
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

export default function NoteTakerPage() {
  const draft = buildNoteTakerDraft();
  return (
    <WorkbenchProjectView
      author={{ id: "wb_malvika", handle: "malvika.jain" }}
      draft={draft}
    />
  );
}
