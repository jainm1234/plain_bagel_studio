import WorkbenchSchematic from "@/components/WorkbenchSchematic";

export default function NoteTakerSchematic() {
  return (
    <WorkbenchSchematic
      boardLabel="esp32-s3 sense"
      buttonPin="d02"
      ledPin="d03"
      hasOnboardMic
    />
  );
}
