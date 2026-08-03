export type MaterialGuess = {
  id: string;
  name: string;
  note?: string;
  evidence: string;
  buyUrl: string;
};

export type StepGuess = {
  id: string;
  title: string;
  details: string[];
};

export type ReverseEngineerResult = {
  projectName: string;
  summary: string;
  description?: string;
  materials: MaterialGuess[];
  steps: StepGuess[];
  schematic: SchematicGuess | null;
};

export type SchematicGuess = {
  boardLabel: string;
  buttonPin: string;
  ledPin: string;
  hasOnboardMic: boolean;
  pinMap: string;
};

function buildSchematic(
  materials: MaterialGuess[],
  code: string,
  projectName: string,
): SchematicGuess | null {
  if (!hasPhysicalHardware(materials)) return null;

  const ids = new Set(materials.map((m) => m.id));
  const buttonRaw =
    code.match(/#define\s+\w*BUTTON\w*\s+(\d+)/i)?.[1] ||
    code.match(/#define\s+\w*BTN\w*\s+(\d+)/i)?.[1] ||
    code.match(/BUTTON\s*=\s*(\d+)/i)?.[1];
  const ledRaw =
    code.match(/#define\s+\w*LED\w*\s+(\d+)/i)?.[1] ||
    code.match(/RECORD_LED\s*=\s*(\d+)/i)?.[1] ||
    code.match(/\bLED\s*=\s*(\d+)/i)?.[1];
  const buttonComment = code.match(
    /#define\s+\w*BUTTON\w*[^\n]*\/\/\s*(d\d+)/i,
  )?.[1];
  const ledComment = code.match(
    /#define\s+\w*LED\w*[^\n]*\/\/\s*(d\d+)/i,
  )?.[1];
  const buttonPin = (
    buttonComment ||
    (buttonRaw ? `d${String(buttonRaw).padStart(2, "0")}` : "gpio")
  ).toLowerCase();
  const ledPin = (
    ledComment || (ledRaw ? `d${String(ledRaw).padStart(2, "0")}` : "gpio")
  ).toLowerCase();
  const hasOnboardMic =
    ids.has("mic") || /setPinsPdmRx|PDM_|Sense/i.test(code);
  const boardLabel = ids.has("esp32")
    ? /sense/i.test(code) || hasOnboardMic
      ? "esp32-s3 sense"
      : "esp32"
    : /esp32/i.test(code)
      ? "esp32"
      : materials.find((m) =>
          /esp32|arduino|pico|stm32|nrf|board|microcontroller/i.test(m.name),
        )?.name ||
        projectName ||
        "board";

  const pinMap = [
    `button  →  ${buttonPin}${buttonRaw ? ` (gpio ${buttonRaw})` : ""}  →  gnd`,
    `led     →  ${ledPin}${ledRaw ? ` (gpio ${ledRaw})` : ""}  →  resistor  →  led (+)`,
    `led (-) →  gnd`,
    hasOnboardMic
      ? "mic     →  built in (no wiring)"
      : ids.has("mic")
        ? "mic     →  i2s / pdm pins from sketch"
        : "mic     →  none",
    "usb     →  computer",
  ].join("\n");

  return {
    boardLabel,
    buttonPin,
    ledPin,
    hasOnboardMic,
    pinMap,
  };
}

/** True when materials include physical electronics / wiring parts. */
export function hasPhysicalHardware(materials: MaterialGuess[]): boolean {
  return materials.some(isHardwareMaterial);
}

export function isHardwareMaterial(material: MaterialGuess): boolean {
  const text = `${material.id} ${material.name} ${material.note || ""}`.toLowerCase();
  if (
    /^(computer|laptop|desktop|ide|vscode|terminal|browser|macos|windows|linux)$/i.test(
      material.name.trim(),
    )
  ) {
    return false;
  }
  if (
    /^(python(\s*\d+(\.\d+)*)?|node(\.js)?|npm|pip|yarn|pnpm|flask|django|fastapi|express|react|next\.?js|typescript|javascript|rustc?|golang|java|docker|kubernetes|aws|cloud|openai-whisper|whisper|bleak|pyserial)$/i.test(
      material.name.trim(),
    )
  ) {
    return false;
  }
  if (/^(pip|npm|yarn|pnpm|apt|brew)\s/i.test(material.name.trim())) {
    return false;
  }
  return /esp32|arduino|pico|stm32|nrf|rp2040|xiao|teensy|raspberry|microcontroller|mcu|gpio|breadboard|jumper|wire|button|led|resistor|servo|motor|buzzer|piezo|mic|microphone|oled|display|sensor|battery|lipo|usb\s*cable|bluetooth|ble|relay|transistor|capacitor|potentiometer|encoder|camera|imu|gyro|accelerometer|neopixel|ws2812|mosfet|shield|hat|breakout|protoboard|solder/i.test(
    text,
  );
}

export function amazonSearchUrl(query: string) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
}

const PARTS_CATALOG: {
  id: string;
  name: string;
  note?: string;
  buyUrl: string;
}[] = [
  {
    id: "esp32",
    name: "esp32",
    note: "microcontroller",
    buyUrl: amazonSearchUrl("ESP32 development board"),
  },
  {
    id: "button",
    name: "push button",
    note: "input",
    buyUrl: amazonSearchUrl("tactile push button switch kit"),
  },
  {
    id: "led",
    name: "led",
    note: "indicator",
    buyUrl: amazonSearchUrl("5mm LED assortment kit"),
  },
  {
    id: "resistor",
    name: "resistor",
    note: "for led / protection",
    buyUrl: amazonSearchUrl("resistor assortment kit 220 ohm"),
  },
  {
    id: "mic",
    name: "microphone",
    note: "pdm / i2s",
    buyUrl: amazonSearchUrl("INMP441 I2S microphone"),
  },
  {
    id: "servo",
    name: "servo",
    buyUrl: amazonSearchUrl("SG90 micro servo motor"),
  },
  {
    id: "ble",
    name: "bluetooth (on board)",
    note: "ble sync",
    buyUrl: amazonSearchUrl("ESP32 bluetooth board"),
  },
  {
    id: "usb",
    name: "usb cable",
    buyUrl: amazonSearchUrl("USB C cable data"),
  },
  {
    id: "breadboard",
    name: "breadboard",
    note: "+ jumper wires",
    buyUrl: amazonSearchUrl("solderless breadboard jumper wire kit"),
  },
  {
    id: "wires",
    name: "jumper wires",
    buyUrl: amazonSearchUrl("dupont jumper wires male female"),
  },
  {
    id: "buzzer",
    name: "buzzer",
    buyUrl: amazonSearchUrl("active buzzer 5v arduino"),
  },
  {
    id: "battery",
    name: "battery pack",
    buyUrl: amazonSearchUrl("18650 battery pack esp32"),
  },
  {
    id: "oled",
    name: "oled display",
    buyUrl: amazonSearchUrl("SSD1306 OLED 0.96 inch I2C"),
  },
  {
    id: "computer",
    name: "computer",
    note: "to flash / run companion",
    buyUrl: amazonSearchUrl("laptop computer"),
  },
];

const buyById = Object.fromEntries(
  PARTS_CATALOG.map((part) => [part.id, part.buyUrl]),
);

type Rule = {
  id: string;
  name: string;
  note?: string;
  test: (code: string, lower: string) => string | null;
};

const rules: Rule[] = [
  {
    id: "esp32",
    name: "esp32",
    note: "microcontroller",
    test: (code, lower) => {
      if (/esp32|ESP_I2S|BLEDevice|XIAO_ESP32/i.test(code)) {
        return "esp32 / ble references in code";
      }
      if (/micropython|circuitpython|machine\.Pin|board\./i.test(lower)) {
        return "micropython / circuitpython pin usage";
      }
      if (/Arduino\.h|void\s+setup\s*\(|#include\s*<Wire/i.test(code)) {
        return "arduino-style sketch";
      }
      return null;
    },
  },
  {
    id: "button",
    name: "push button",
    note: "input",
    test: (code) => {
      const match = code.match(
        /#define\s+(\w*BUTTON\w*|\w*BTN\w*|\w*KEY\w*)\s+(\d+)/i,
      );
      if (match) return `${match[1]} on gpio ${match[2]}`;
      if (/button|INPUT_PULLUP|digitalRead/i.test(code)) {
        return "button / digitalRead / pull-up usage";
      }
      return null;
    },
  },
  {
    id: "led",
    name: "led",
    note: "indicator",
    test: (code) => {
      const match = code.match(/#define\s+(\w*LED\w*)\s+(\d+)/i);
      if (match) return `${match[1]} on gpio ${match[2]}`;
      if (/digitalWrite\s*\([^,]+,\s*(HIGH|LOW)/i.test(code) && /led/i.test(code)) {
        return "led digitalWrite usage";
      }
      return null;
    },
  },
  {
    id: "resistor",
    name: "resistor",
    note: "for led / protection",
    test: (code, lower) => {
      if (/resistor|220|330|1k/i.test(code)) return "mentioned in code/comments";
      if (/#define\s+\w*LED\w*/i.test(code) || lower.includes("led")) {
        return "likely needed with led wiring";
      }
      return null;
    },
  },
  {
    id: "mic",
    name: "microphone",
    note: "pdm / i2s",
    test: (code) => {
      if (/PDM|I2S|INMP441|microphone|mic\b|setPinsPdmRx/i.test(code)) {
        return "audio / pdm / i2s references";
      }
      return null;
    },
  },
  {
    id: "servo",
    name: "servo",
    test: (code) => {
      if (/Servo|servo\.write|#include\s*<Servo/i.test(code)) {
        return "servo library / write calls";
      }
      return null;
    },
  },
  {
    id: "ble",
    name: "bluetooth (on board)",
    note: "ble sync",
    test: (code) => {
      if (/BLEDevice|Bleak|bluetooth|BLE_/i.test(code)) {
        return "ble / bluetooth references";
      }
      return null;
    },
  },
  {
    id: "usb",
    name: "usb cable",
    test: (code) => {
      if (/Serial\.|USB|usb-?c|upload|flash/i.test(code)) {
        return "serial / usb / flash usage";
      }
      return null;
    },
  },
  {
    id: "breadboard",
    name: "breadboard",
    note: "+ jumper wires",
    test: (code, lower) => {
      if (lower.includes("breadboard")) return "mentioned in code/comments";
      if (/gpio|pinMode|digitalRead|digitalWrite|machine\.Pin|board\./i.test(code)) {
        return "gpio wiring usually needs a breadboard + wires";
      }
      return null;
    },
  },
  {
    id: "wires",
    name: "jumper wires",
    test: (code, lower) => {
      if (/jumper|dupont|wire/i.test(lower)) return "mentioned in code/comments";
      if (/gpio|pinMode|digitalRead|digitalWrite|machine\.Pin/i.test(code)) {
        return "likely needed for gpio connections";
      }
      return null;
    },
  },
  {
    id: "buzzer",
    name: "buzzer",
    test: (code) => {
      if (/buzzer|tone\s*\(|piezo|passive.?buzzer/i.test(code)) {
        return "buzzer / tone usage";
      }
      return null;
    },
  },
  {
    id: "battery",
    name: "battery pack",
    test: (code) => {
      if (/battery|lipo|18650|power.?bank/i.test(code)) {
        return "battery / power references";
      }
      return null;
    },
  },
  {
    id: "oled",
    name: "oled display",
    test: (code) => {
      if (/SSD1306|OLED|Adafruit_SSD1306|u8g2|display\.draw/i.test(code)) {
        return "oled / display library usage";
      }
      return null;
    },
  },
  {
    id: "computer",
    name: "computer",
    note: "to flash / run companion",
    test: (code, lower) => {
      if (
        /flask|whisper|fastapi|django|express|localhost|pip install|npm install|bleak|pyserial/i.test(
          lower,
        )
      ) {
        return "companion / desktop app detected";
      }
      if (/void\s+setup\s*\(|void\s+loop\s*\(|if __name__ == ['\"]__main__['\"]/i.test(code)) {
        return "script needs a computer to run or upload";
      }
      return null;
    },
  },
];

function guessProjectNameFromSource(
  filename = "code",
  code = "",
  extras: {
    folderHint?: string;
    relatedTitles?: string[];
    socialTitle?: string;
  } = {},
): string {
  const folder = extras.folderHint?.trim();
  if (folder) {
    return folder.replace(/[_-]+/g, " ").toLowerCase();
  }

  const socialTitle = extras.socialTitle?.trim();
  if (
    socialTitle &&
    socialTitle.length > 2 &&
    socialTitle.length < 80 &&
    !/^(instagram|tiktok|youtube|x|reddit|post|reel)$/i.test(socialTitle)
  ) {
    return socialTitle.replace(/[_-]+/g, " ").toLowerCase();
  }

  const pathBase = filename
    .split("/")
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (
    pathBase &&
    !/^(code|main|app|index|sketch|untitled|pasted|script-\d+)$/i.test(pathBase)
  ) {
    return pathBase.toLowerCase();
  }

  const fromFolderInPath = filename.includes("/")
    ? filename.split("/")[0].replace(/[_-]+/g, " ").trim()
    : "";
  if (
    fromFolderInPath &&
    !/^(src|lib|app|code|scripts|firmware)$/i.test(fromFolderInPath)
  ) {
    return fromFolderInPath.toLowerCase();
  }

  const bleName = code.match(
    /BLEDevice::init\s*\(\s*["']([^"']+)["']\s*\)/i,
  );
  if (bleName?.[1]) return bleName[1].toLowerCase();

  const stringTitle = code.match(
    /(?:project|title|name|app_name)\s*[:=]\s*["']([^"']{2,60})["']/i,
  );
  if (stringTitle?.[1]) return stringTitle[1].toLowerCase();

  const docTitle = code.match(
    /(?:^|\n)\s*(?:\/\/|#|\/\*\*?)\s*(?:project\s*:?\s*)?([a-z0-9][a-z0-9 \-_]{2,50})\s*(?:\*\/|\n|$)/i,
  );
  if (
    docTitle?.[1] &&
    !/hold |define |include |ready |pip |upload |copyright|license|todo/i.test(
      docTitle[1],
    )
  ) {
    return docTitle[1].replace(/[_-]+/g, " ").trim().toLowerCase();
  }

  const related = extras.relatedTitles?.find((title) => title.trim());
  if (related) return related.trim().toLowerCase();

  return "";
}

function guessName(
  filename: string,
  code: string,
  extras: {
    folderHint?: string;
    relatedTitles?: string[];
    socialTitle?: string;
  } = {},
): string {
  return (
    guessProjectNameFromSource(filename, code, extras) || "untitled project"
  );
}

function buildSteps(
  materials: MaterialGuess[],
  code: string,
): StepGuess[] {
  const ids = new Set(materials.map((m) => m.id));
  const steps: StepGuess[] = [
    {
      id: "gather",
      title: "gather parts",
      details: [
        `collect: ${materials.map((m) => m.name).join(", ") || "the materials for this project"}.`,
      ],
    },
  ];

  if (ids.has("breadboard") && ids.has("esp32")) {
    steps.push({
      id: "mount",
      title: "place the board",
      details: [
        "put the microcontroller on the breadboard so the pins sit firmly.",
      ],
    });
  }

  if (ids.has("button")) {
    const pin =
      code.match(/#define\s+\w*BUTTON\w*\s+(\d+)/i)?.[1] ||
      code.match(/#define\s+\w*BTN\w*\s+(\d+)/i)?.[1] ||
      code.match(/Button\s*\(\s*(\d+)/i)?.[1];
    steps.push({
      id: "wire-button",
      title: "wire the button",
      details: [
        pin
          ? `connect one side of the button to gpio ${pin}.`
          : "connect one side of the button to the gpio pin used in the code.",
        "connect the other side to gnd.",
      ],
    });
  }

  if (ids.has("led")) {
    const pin =
      code.match(/#define\s+\w*LED\w*\s+(\d+)/i)?.[1] ||
      code.match(/LED\s*=\s*(\d+)/i)?.[1];
    steps.push({
      id: "wire-led",
      title: "wire the led",
      details: [
        pin
          ? `connect gpio ${pin} to a resistor, then to the led anode (long leg).`
          : "connect the led gpio from the code to a resistor, then to the led anode.",
        "connect the led cathode (short leg) to gnd.",
      ],
    });
  }

  if (ids.has("mic")) {
    steps.push({
      id: "mic",
      title: "microphone",
      details: [
        /setPinsPdmRx|PDM_/i.test(code)
          ? "if your board has an onboard pdm mic, no extra wiring is needed."
          : "wire the microphone to the i2s / pdm pins used in the sketch.",
      ],
    });
  }

  if (ids.has("servo")) {
    steps.push({
      id: "servo",
      title: "wire the servo",
      details: [
        "connect servo power and ground to the board.",
        "connect the signal wire to the servo pin used in the code.",
      ],
    });
  }

  if (ids.has("oled")) {
    steps.push({
      id: "oled",
      title: "wire the display",
      details: [
        "connect the oled vcc/gnd and i2c (sda/scl) pins used in the code.",
      ],
    });
  }

  if (ids.has("buzzer")) {
    steps.push({
      id: "buzzer",
      title: "wire the buzzer",
      details: [
        "connect the buzzer signal pin from the code, plus power/ground as needed.",
      ],
    });
  }

  const isPython = /\.py\b|import |def |pip /i.test(code);
  const isArduino = /void\s+setup\s*\(|\.ino\b|#include\s*</i.test(code);

  steps.push({
    id: "flash",
    title: isPython && !isArduino ? "run the script" : "flash the code",
    details: isPython && !isArduino
      ? [
          "install any packages imported by the script.",
          "run the main script on your computer or device.",
        ]
      : [
          "open the uploaded sketch in your editor (arduino ide, platformio, etc).",
          "select the correct board and port, then upload.",
        ],
  });

  if (/flask|whisper|fastapi|bleak|localhost:\d+/i.test(code)) {
    steps.push({
      id: "companion",
      title: "run the companion",
      details: [
        "install any python packages imported by the companion app.",
        "run the companion on your computer and keep it open.",
      ],
    });
  }

  steps.push({
    id: "test",
    title: "try it",
    details: [
      "power the project and test the main interaction from the code.",
      "if something fails, re-check wiring against the pins in the sketch.",
    ],
  });

  return steps;
}

function reverseEngineerCode(
  code: string,
  filename = "code",
  extras: {
    folderHint?: string;
    relatedTitles?: string[];
    socialTitle?: string;
    socialDescription?: string;
  } = {},
): ReverseEngineerResult {
  const lower = code.toLowerCase();
  const materials: MaterialGuess[] = [];

  for (const rule of rules) {
    const evidence = rule.test(code, lower);
    if (!evidence) continue;
    materials.push({
      id: rule.id,
      name: rule.name,
      note: rule.note,
      evidence,
      buyUrl: buyById[rule.id] || amazonSearchUrl(rule.name),
    });
  }

  const unique = [...new Map(materials.map((m) => [m.id, m])).values()];
  const hardware = unique.filter(isHardwareMaterial);
  const projectName = guessName(filename, code, extras);

  let summary = "";
  if (extras.socialDescription?.trim()) {
    summary = extras.socialDescription.trim().toLowerCase();
  } else if (hardware.length) {
    summary = `a ${projectName} build using ${hardware
      .slice(0, 4)
      .map((m) => m.name)
      .join(", ")}${hardware.length > 4 ? ", and more" : ""}.`;
  } else if (code.trim()) {
    summary = `a ${projectName} software project — no hardware parts detected.`;
  } else if (extras.socialTitle) {
    summary = `a project inspired by your ${extras.socialTitle} post — add code or materials to fill in the details.`;
  } else {
    summary = "add your code or materials to flesh out this project.";
  }

  return {
    projectName,
    summary,
    description: summary,
    materials: hardware,
    steps: code.trim()
      ? hardware.length
        ? buildSteps(hardware, code)
        : [
            {
              id: "open",
              title: "open the project",
              details: [
                "read the uploaded scripts and note how to install and run them.",
              ],
            },
            {
              id: "run",
              title: "run it",
              details: [
                "install any dependencies from the project files, then run the main entrypoint.",
              ],
            },
          ]
      : [
          {
            id: "watch",
            title: "review the social post",
            details: [
              "open the linked post and note how the project works.",
              "upload the project scripts so steps can be filled in automatically.",
            ],
          },
        ],
    schematic: buildSchematic(hardware, code, projectName),
  };
}

/** Analyze scripts and optional social hints into one project draft. */
export function reverseEngineerProject(input: {
  code: string;
  filename?: string;
  folderHint?: string;
  relatedTitles?: string[];
  socialTitle?: string;
  socialDescription?: string;
}): ReverseEngineerResult {
  return reverseEngineerCode(input.code, input.filename || "code", {
    folderHint: input.folderHint,
    relatedTitles: input.relatedTitles,
    socialTitle: input.socialTitle,
    socialDescription: input.socialDescription,
  });
}
