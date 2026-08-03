type Props = {
  boardLabel?: string;
  buttonPin?: string;
  ledPin?: string;
  hasOnboardMic?: boolean;
  caption?: string;
};

export default function WorkbenchSchematic({
  boardLabel = "microcontroller",
  buttonPin = "gpio",
  ledPin = "gpio",
  hasOnboardMic = false,
  caption,
}: Props) {
  const buttonLabel = buttonPin.toLowerCase().startsWith("d")
    ? buttonPin
    : buttonPin.match(/^\d+$/)
      ? `gpio ${buttonPin}`
      : buttonPin;
  const ledLabel = ledPin.toLowerCase().startsWith("d")
    ? ledPin
    : ledPin.match(/^\d+$/)
      ? `gpio ${ledPin}`
      : ledPin;

  return (
    <figure className="workbench-schematic">
      <svg
        className="workbench-schematic-svg"
        viewBox="0 0 720 420"
        role="img"
        aria-label={`Schematic: ${boardLabel} with button on ${buttonLabel} and led on ${ledLabel}`}
      >
        <rect
          x="40"
          y="80"
          width="200"
          height="260"
          fill="#fff"
          stroke="#000"
          strokeWidth="1.5"
        />
        <text
          x="140"
          y="110"
          textAnchor="middle"
          className="workbench-schematic-label"
        >
          {boardLabel}
        </text>
        {hasOnboardMic ? (
          <>
            <text
              x="140"
              y="132"
              textAnchor="middle"
              className="workbench-schematic-muted"
            >
              pdm mic on board
            </text>
            <circle
              cx="140"
              cy="175"
              r="18"
              fill="none"
              stroke="#000"
              strokeWidth="1.25"
            />
            <circle cx="140" cy="175" r="6" fill="#000" />
            <text
              x="140"
              y="210"
              textAnchor="middle"
              className="workbench-schematic-muted"
            >
              mic (built-in)
            </text>
          </>
        ) : (
          <text
            x="140"
            y="160"
            textAnchor="middle"
            className="workbench-schematic-muted"
          >
            board
          </text>
        )}

        <text x="55" y="250" className="workbench-schematic-label">
          {buttonLabel}
        </text>
        <text x="55" y="290" className="workbench-schematic-label">
          {ledLabel}
        </text>
        <text x="55" y="330" className="workbench-schematic-label">
          gnd
        </text>

        <circle cx="240" cy="245" r="4" fill="#000" />
        <circle cx="240" cy="285" r="4" fill="#000" />
        <circle cx="240" cy="325" r="4" fill="#000" />

        <rect
          x="100"
          y="50"
          width="80"
          height="30"
          fill="#fff"
          stroke="#000"
          strokeWidth="1.25"
        />
        <text
          x="140"
          y="70"
          textAnchor="middle"
          className="workbench-schematic-muted"
        >
          usb
        </text>

        <path
          d="M 244 245 H 360 V 180 H 420"
          fill="none"
          stroke="#000"
          strokeWidth="1.5"
        />
        <line
          x1="420"
          y1="165"
          x2="420"
          y2="195"
          stroke="#000"
          strokeWidth="1.5"
        />
        <line
          x1="420"
          y1="180"
          x2="460"
          y2="180"
          stroke="#000"
          strokeWidth="1.5"
        />
        <line
          x1="448"
          y1="168"
          x2="448"
          y2="192"
          stroke="#000"
          strokeWidth="1.5"
        />
        <circle cx="420" cy="180" r="3" fill="#000" />
        <circle cx="460" cy="180" r="3" fill="#000" />
        <text
          x="440"
          y="155"
          textAnchor="middle"
          className="workbench-schematic-label"
        >
          button
        </text>
        <text
          x="440"
          y="215"
          textAnchor="middle"
          className="workbench-schematic-muted"
        >
          hold / press
        </text>

        <path
          d="M 460 180 H 520 V 325 H 244"
          fill="none"
          stroke="#000"
          strokeWidth="1.5"
        />

        <path d="M 244 285 H 340" fill="none" stroke="#000" strokeWidth="1.5" />
        <path
          d="M 340 285 L 350 270 L 365 300 L 380 270 L 395 300 L 410 270 L 425 300 L 440 285"
          fill="none"
          stroke="#000"
          strokeWidth="1.5"
        />
        <text
          x="390"
          y="255"
          textAnchor="middle"
          className="workbench-schematic-label"
        >
          220Ω
        </text>
        <path d="M 440 285 H 500" fill="none" stroke="#000" strokeWidth="1.5" />
        <polygon
          points="500,270 500,300 530,285"
          fill="none"
          stroke="#000"
          strokeWidth="1.5"
        />
        <line
          x1="530"
          y1="270"
          x2="530"
          y2="300"
          stroke="#000"
          strokeWidth="1.5"
        />
        <path d="M 535 268 L 548 255" stroke="#000" strokeWidth="1" />
        <path d="M 538 272 L 552 262" stroke="#000" strokeWidth="1" />
        <text
          x="515"
          y="255"
          textAnchor="middle"
          className="workbench-schematic-label"
        >
          led
        </text>
        <text
          x="515"
          y="320"
          textAnchor="middle"
          className="workbench-schematic-muted"
        >
          +   −
        </text>

        <path
          d="M 530 285 H 560 V 325 H 520"
          fill="none"
          stroke="#000"
          strokeWidth="1.5"
        />
        <line
          x1="230"
          y1="325"
          x2="560"
          y2="325"
          stroke="#000"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
        <text x="580" y="329" className="workbench-schematic-muted">
          gnd
        </text>

        <text x="290" y="238" className="workbench-schematic-muted">
          {buttonLabel}
        </text>
        <text x="290" y="278" className="workbench-schematic-muted">
          {ledLabel}
        </text>
      </svg>
      {caption ? (
        <figcaption className="workbench-schematic-caption">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
