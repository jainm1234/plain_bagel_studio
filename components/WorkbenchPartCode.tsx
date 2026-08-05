type Props = {
  code: string;
  color: string;
};

export default function WorkbenchPartCode({ code, color }: Props) {
  return (
    <span
      className="workbench-part-code"
      style={{ color, borderColor: color, background: `${color}14` }}
      aria-hidden="true"
    >
      {code}
    </span>
  );
}
