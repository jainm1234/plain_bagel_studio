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
    note: "with pdm mic",
    buy: amazonSearchUrl("Seeed XIAO ESP32S3 Sense"),
  },
  {
    name: "breadboard",
    buy: amazonSearchUrl("solderless breadboard"),
  },
  {
    name: "jumper wires",
    note: "male-to-male",
    buy: amazonSearchUrl("dupont jumper wires male to male"),
  },
  {
    name: "push button",
    note: "hold to record",
    buy: amazonSearchUrl("tactile push button switch kit"),
  },
  {
    name: "led",
    note: "rec indicator",
    buy: amazonSearchUrl("5mm LED assortment kit"),
  },
  {
    name: "resistor",
    note: "~220Ω for led",
    buy: amazonSearchUrl("220 ohm resistor assortment"),
  },
  {
    name: "usb cable",
    note: "usb-c",
    buy: amazonSearchUrl("USB C cable data"),
  },
];

const steps = [
  {
    title: "gather your parts",
    details: [
      "get everything from the materials list: esp32-s3 sense, push button, led, resistor, breadboard, jumper wires, and usb cable.",
      "you also need a computer with python 3 and the arduino ide installed.",
    ],
  },
  {
    title: "put the board on the breadboard",
    details: [
      "place the esp32-s3 sense onto the breadboard so its pins sit firmly in the holes.",
      "leave space next to it for the button and led.",
    ],
  },
  {
    title: "wire the button",
    details: [
      "take two jumper wires.",
      "connect one side of the button to pin d02 (gpio 2) on the esp32.",
      "connect the other side of the button to gnd (ground).",
      "when you press the button, the board will start recording.",
    ],
  },
  {
    title: "wire the led",
    details: [
      "find the longer leg of the led — that is the positive side (anode).",
      "connect pin d03 (gpio 3) to one end of the resistor.",
      "connect the other end of the resistor to the longer leg of the led.",
      "connect the shorter leg of the led to gnd.",
      "the led should light up while you are recording.",
    ],
  },
  {
    title: "skip the mic wiring",
    details: [
      "the esp32-s3 sense already has a microphone built in.",
      "you do not need to connect any extra mic wires.",
    ],
  },
  {
    title: "download and open the firmware",
    details: [
      "download notebook_recorder.ino from the scripts section below.",
      "open it in the arduino ide.",
    ],
  },
  {
    title: "set up the arduino ide for esp32",
    details: [
      "in arduino ide, go to board manager and install the “esp32” package by espressif.",
      "plug the esp32 into your computer with the usb cable.",
      "under tools → board, choose your esp32-s3 board.",
      "under tools → port, choose the port that appears when the board is plugged in.",
    ],
  },
  {
    title: "upload the firmware",
    details: [
      "click upload and wait until it finishes.",
      "open serial monitor and set the baud rate to 115200.",
      "you should see a message like “ready — hold d02 to record.”",
    ],
  },
  {
    title: "install the companion app",
    details: [
      "download recorder_ui.py from the scripts section below.",
      "open a terminal on your computer.",
      "run: pip install flask pyserial openai-whisper bleak",
      "then run: python recorder_ui.py",
      "a browser window should open at http://localhost:5000",
    ],
  },
  {
    title: "record your first note",
    details: [
      "keep the companion app running.",
      "hold the button, speak your note, then let go.",
      "the led lights while you hold the button.",
      "when you release, the recording syncs over bluetooth, gets transcribed, and saves to ~/desktop/recordings.",
      "if bluetooth does not connect, plug the board in with usb and click “usb sync” in the companion app.",
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
    coverImage: null,
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
