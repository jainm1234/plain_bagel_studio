// Hold D02 (GPIO 2) to record. BLE auto-sync, or USB via web app.

#include <ESP_I2S.h>
#include <LittleFS.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

I2SClass i2s;

#define PDM_CLK     42
#define PDM_DATA    41
#define BUTTON      2    // D02
#define RECORD_LED  3    // D03 → resistor → LED → GND
#define SAMPLE_RATE 16000

#define SERVICE_UUID "F0000001-0000-4000-8000-000000000001"
#define META_UUID    "F0000002-0000-4000-8000-000000000002"
#define AUDIO_UUID   "F0000003-0000-4000-8000-000000000003"
#define CTRL_UUID    "F0000004-0000-4000-8000-000000000004"

#define BLE_CHUNK 200
#define BLE_DELAY 30

int nextIndex = 0;
bool recording = false;
bool bleConnected = false;
bool bleAppReady = false;
bool bleSendPending = false;
File recFile;

BLECharacteristic* metaChar = nullptr;
BLECharacteristic* audioChar = nullptr;
BLECharacteristic* ctrlChar = nullptr;

class BleCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) {
    bleConnected = true;
    bleAppReady = false;
    bleSendPending = false;
    BLEDevice::setMTU(517);
  }

  void onDisconnect(BLEServer* server) {
    bleConnected = false;
    bleAppReady = false;
    bleSendPending = false;
    BLEDevice::startAdvertising();
  }
};

class CtrlCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* ch) {
    String value = ch->getValue();
    if (value.length() > 0 && (uint8_t)value[0] == 0x01) {
      bleAppReady = true;
      bleSendPending = true;
    }
  }
};

void loadCounter() {
  File f = LittleFS.open("/counter.txt", "r");
  if (f) {
    nextIndex = f.parseInt();
    f.close();
  }
}

void saveCounter() {
  File f = LittleFS.open("/counter.txt", "w");
  if (f) {
    f.print(nextIndex);
    f.close();
  }
}

void compactIfEmpty() {
  for (int i = 0; i < nextIndex; i++) {
    if (LittleFS.exists("/rec_" + String(i) + ".pcm")) return;
  }
  nextIndex = 0;
  saveCounter();
}

bool sendBleFile(int i) {
  if (!bleConnected || !metaChar || !audioChar || !ctrlChar) return false;

  String path = "/rec_" + String(i) + ".pcm";
  if (!LittleFS.exists(path)) return false;

  File f = LittleFS.open(path, "r");
  if (!f) return false;

  uint32_t size = f.size();
  uint8_t sz[4];
  memcpy(sz, &size, 4);
  metaChar->setValue(sz, 4);
  metaChar->notify();
  delay(50);

  uint8_t buf[BLE_CHUNK];
  while (f.available()) {
    int n = f.read(buf, sizeof(buf));
    if (n <= 0) break;
    audioChar->setValue(buf, n);
    audioChar->notify();
    delay(BLE_DELAY);
  }
  f.close();

  delay(100);
  uint8_t end = 0xFF;
  ctrlChar->setValue(&end, 1);
  ctrlChar->notify();
  delay(50);

  LittleFS.remove(path);
  compactIfEmpty();
  return true;
}

void sendAllBle() {
  for (int i = 0; i < nextIndex; i++) {
    if (!LittleFS.exists("/rec_" + String(i) + ".pcm")) continue;
    if (!sendBleFile(i)) break;
  }
}

void setupBle() {
  BLEDevice::init("Notebook Recorder");
  BLEDevice::setMTU(517);

  BLEServer* server = BLEDevice::createServer();
  server->setCallbacks(new BleCallbacks());

  BLEService* service = server->createService(SERVICE_UUID);

  metaChar = service->createCharacteristic(META_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  metaChar->addDescriptor(new BLE2902());

  audioChar = service->createCharacteristic(AUDIO_UUID, BLECharacteristic::PROPERTY_NOTIFY);
  audioChar->addDescriptor(new BLE2902());

  ctrlChar = service->createCharacteristic(
    CTRL_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_WRITE
  );
  ctrlChar->addDescriptor(new BLE2902());
  ctrlChar->setCallbacks(new CtrlCallbacks());

  service->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->start();
}

void sendFileUsb(int i) {
  String path = "/rec_" + String(i) + ".pcm";
  if (!LittleFS.exists(path)) return;

  File f = LittleFS.open(path, "r");
  if (!f) return;

  Serial.println("FILE:" + String(i) + ":" + String(f.size()));

  uint8_t buf[512];
  while (f.available()) {
    int n = f.read(buf, sizeof(buf));
    if (n > 0) Serial.write(buf, n);
  }
  f.close();
  Serial.println("EOF");
}

void syncFiles() {
  int count = 0;
  for (int i = 0; i < nextIndex; i++) {
    if (LittleFS.exists("/rec_" + String(i) + ".pcm")) count++;
  }

  Serial.println("COUNT:" + String(count));
  for (int i = 0; i < nextIndex; i++) sendFileUsb(i);
  Serial.println("SYNCDONE");
}

void clearFiles() {
  for (int i = 0; i < nextIndex; i++) {
    LittleFS.remove("/rec_" + String(i) + ".pcm");
  }
  nextIndex = 0;
  saveCounter();
  Serial.println("CLEARED");
}

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON, INPUT_PULLUP);
  pinMode(RECORD_LED, OUTPUT);
  digitalWrite(RECORD_LED, LOW);  // off when idle

  LittleFS.begin(true);
  loadCounter();

  i2s.setPinsPdmRx(PDM_CLK, PDM_DATA);
  i2s.begin(I2S_MODE_PDM_RX, SAMPLE_RATE, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO);

  setupBle();
  Serial.println("READY — hold D02 to record");
  Serial.println("Button GPIO " + String(BUTTON) + " reads " + String(digitalRead(BUTTON)) + " (1=open, 0=pressed)");
}

void loop() {
  pinMode(BUTTON, INPUT_PULLUP);

  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd == "SYNC") syncFiles();
    if (cmd == "CLEAR") clearFiles();
  }

  if (bleConnected && bleSendPending && !recording) {
    bleSendPending = false;
    sendAllBle();
  }

  int raw = digitalRead(BUTTON);
  bool held = raw == LOW;

  static bool lastHeld = false;
  if (held != lastHeld) {
    lastHeld = held;
    Serial.print("D02: ");
    Serial.print(held ? "PRESSED" : "RELEASED");
    Serial.print("  raw=");
    Serial.println(raw);
  }

  if (held && !recording) {
    recFile = LittleFS.open("/rec_" + String(nextIndex) + ".pcm", "w");
    if (recFile) {
      recording = true;
      Serial.println("REC_START " + String(nextIndex));
    } else {
      Serial.println("REC_START failed — could not open file");
    }
  }

  if (!held && recording) {
    recFile.close();
    int saved = nextIndex;
    nextIndex++;
    saveCounter();
    recording = false;
    Serial.println("REC_DONE");
    if (bleConnected && bleAppReady) sendBleFile(saved);
  }

  if (recording) {
    uint8_t buf[512];
    int n = i2s.readBytes((char*)buf, sizeof(buf));
    if (n > 0) recFile.write(buf, n);
  }

  digitalWrite(RECORD_LED, recording ? HIGH : LOW);
}
