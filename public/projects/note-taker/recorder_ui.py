from flask import Flask, jsonify, send_file
import os, wave, threading, webbrowser, time, asyncio
import serial
import serial.tools.list_ports
import whisper

try:
    from bleak import BleakClient, BleakScanner
    BLE_OK = True
except ImportError:
    BLE_OK = False

app = Flask(__name__)

SAVE_FOLDER = os.path.expanduser("~/Desktop/recordings")
SAMPLE_RATE = 16000
BAUD_RATE = 115200

SERVICE_UUID = "F0000001-0000-4000-8000-000000000001"
META_UUID    = "F0000002-0000-4000-8000-000000000002"
AUDIO_UUID   = "F0000003-0000-4000-8000-000000000003"
CTRL_UUID    = "F0000004-0000-4000-8000-000000000004"
DEVICE_NAME  = "Notebook Recorder"
BLE_READY    = b"\x01"

os.makedirs(SAVE_FOLDER, exist_ok=True)

sync_status = {"running": False, "message": "Ready"}
ble_status = {
    "connected": False,
    "message": "Bluetooth ready" if BLE_OK else "Install bleak: pip install bleak",
    "list_updated": False,
}
status_lock = threading.Lock()
whisper_model = None

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>recordings</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Courier New", Courier, monospace;
      font-size: 14px; line-height: 1.5;
      background: #fff; color: #000; min-height: 100vh;
    }
    header {
      border-bottom: 2px solid #000;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    header h1, button, .rec-name, .transcription, #empty, #status-bar, #ble-bar {
      font-size: 14px;
      font-family: inherit;
    }

    button {
      background: #fff;
      color: #000;
      border: 2px solid #000;
      padding: 6px 12px;
      cursor: pointer;
    }
    button:hover { background: #000; color: #fff; }
    button:disabled {
      background: #fff;
      color: #999;
      border-color: #999;
      cursor: not-allowed;
    }
    button:disabled:hover { background: #fff; color: #999; }

    #status-bar, #ble-bar {
      border-bottom: 2px solid #000;
      padding: 10px 20px;
    }
    #status-bar { display: none; }
    #ble-bar.connected { background: #e8ffe8; }
    #ble-bar.disconnected { background: #fff8e8; }

    main { padding: 0; }

    #empty { padding: 20px; margin-top: 20px; color: #999; }

    .list { display: flex; flex-direction: column; }

    .rec {
      border-top: 2px solid #000;
      padding: 16px 20px;
      width: 100%;
    }

    .rec-name { margin-bottom: 8px; }

    .transcription {
      margin-bottom: 12px;
      white-space: pre-wrap;
    }

    .rec-actions { display: flex; gap: 8px; flex-wrap: wrap; }

    .icon-btn {
      width: 36px;
      height: 36px;
      padding: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 0;
    }
    .icon-btn svg {
      width: 16px;
      height: 16px;
      display: block;
    }
    .btn-play .icon-stop { display: none; }
    .btn-play.playing .icon-play { display: none; }
    .btn-play.playing .icon-stop { display: block; }
    .btn-copy .icon-check { display: none; }
    .btn-copy.copied .icon-copy { display: none; }
    .btn-copy.copied .icon-check { display: block; }
  </style>
</head>
<body>
<header>
  <h1>recordings</h1>
  <button id="sync-btn" onclick="sync()" title="USB fallback">usb sync</button>
</header>
<div id="ble-bar" class="disconnected">bluetooth...</div>
<div id="status-bar"></div>
<main>
  <div id="empty" style="display:none">no recordings — they'll sync over bluetooth automatically</div>
  <div class="list" id="grid"></div>
</main>
<script>
  const player = new Audio();
  let playingBtn = null;

  player.onended = () => {
    if (playingBtn) playingBtn.classList.remove('playing');
    playingBtn = null;
  };

  async function loadList() {
    const recs = await (await fetch('/recordings')).json();
    const grid = document.getElementById('grid');
    const empty = document.getElementById('empty');
    grid.innerHTML = '';

    if (!recs.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    recs.reverse().forEach(rec => {
      const el = document.createElement('div');
      el.className = 'rec';
      el.innerHTML = `
        <div class="rec-name">${rec.name}</div>
        <div class="transcription">${rec.text}</div>
        <div class="rec-actions">
          <button type="button" class="icon-btn btn-play" aria-label="Play" onclick="togglePlay('${rec.name}', this)">
            <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
            <svg class="icon-stop" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12"/></svg>
          </button>
          <button type="button" class="icon-btn btn-copy" aria-label="Copy" onclick="copyText(this)">
            <svg class="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            <svg class="icon-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>
          </button>
          <button type="button" class="icon-btn btn-delete" aria-label="Delete" onclick="deleteRec('${rec.name}', this)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
          </button>
        </div>`;
      grid.appendChild(el);
    });
  }

  function togglePlay(name, btn) {
    const src = '/audio/' + name;
    if (playingBtn && playingBtn !== btn) playingBtn.classList.remove('playing');

    if (player.src.endsWith(src) && !player.paused) {
      player.pause();
      btn.classList.remove('playing');
      playingBtn = null;
      return;
    }

    player.src = src;
    player.play();
    btn.classList.add('playing');
    playingBtn = btn;
  }

  function copyText(btn) {
    const text = btn.closest('.rec').querySelector('.transcription').innerText;
    navigator.clipboard.writeText(text).then(() => {
      btn.classList.add('copied');
      setTimeout(() => btn.classList.remove('copied'), 1500);
    });
  }

  async function deleteRec(name, btn) {
    if (!confirm('Delete ' + name + '?')) return;
    if (player.src.endsWith('/audio/' + name)) {
      player.pause();
      player.removeAttribute('src');
      if (playingBtn) playingBtn.classList.remove('playing');
      playingBtn = null;
    }
    await fetch('/delete/' + name, { method: 'DELETE' });
    btn.closest('.rec').remove();
    if (!document.querySelector('.rec')) document.getElementById('empty').style.display = 'block';
  }

  async function sync() {
    const btn = document.getElementById('sync-btn');
    btn.disabled = true;
    setStatus('Syncing...');
    await fetch('/sync', { method: 'POST' });

    const timer = setInterval(async () => {
      const s = await (await fetch('/sync/status')).json();
      setStatus(s.message);
      if (!s.running) {
        clearInterval(timer);
        btn.disabled = false;
        loadList();
      }
    }, 500);
  }

  function setStatus(msg) {
    const bar = document.getElementById('status-bar');
    bar.style.display = 'block';
    bar.textContent = msg;
  }

  async function pollBle() {
    try {
      const s = await (await fetch('/ble/status')).json();
      const bar = document.getElementById('ble-bar');
      bar.textContent = s.message;
      bar.className = s.connected ? 'connected' : 'disconnected';
      if (s.list_updated) {
        await loadList();
        await fetch('/ble/clear-updated', { method: 'POST' });
      }
    } catch (e) {}
  }

  loadList();
  setInterval(pollBle, 1500);
  pollBle();
</script>
</body>
</html>
"""


@app.route("/")
def index():
    return HTML


@app.route("/recordings")
def list_recordings():
    recs = []
    for wav in sorted(f for f in os.listdir(SAVE_FOLDER) if f.endswith(".wav")):
        name = wav[:-4]
        txt = os.path.join(SAVE_FOLDER, name + ".txt")
        text = open(txt).read() if os.path.exists(txt) else ""
        recs.append({"name": name, "text": text})
    return jsonify(recs)


@app.route("/audio/<name>")
def get_audio(name):
    return send_file(os.path.join(SAVE_FOLDER, name + ".wav"), mimetype="audio/wav")


@app.route("/delete/<name>", methods=["DELETE"])
def delete_recording(name):
    for ext in (".wav", ".txt"):
        path = os.path.join(SAVE_FOLDER, name + ext)
        if os.path.exists(path):
            os.remove(path)
    return jsonify({"ok": True})


@app.route("/sync", methods=["POST"])
def sync():
    if sync_status["running"]:
        return jsonify({"error": "busy"})
    threading.Thread(target=do_sync, daemon=True).start()
    return jsonify({"ok": True})


@app.route("/sync/status")
def get_sync_status():
    return jsonify(sync_status)


@app.route("/ble/status")
def get_ble_status():
    with status_lock:
        return jsonify(dict(ble_status))


@app.route("/ble/clear-updated", methods=["POST"])
def clear_ble_updated():
    with status_lock:
        ble_status["list_updated"] = False
    return jsonify({"ok": True})


def find_port():
    for p in serial.tools.list_ports.comports():
        dev = p.device
        if dev.startswith("/dev/tty."):
            cu = "/dev/cu." + dev[9:]
            if os.path.exists(cu):
                dev = cu
        if "usbmodem" in dev or "SLAB" in dev or "CH340" in dev:
            return dev
    return None


def next_index():
    nums = []
    for f in os.listdir(SAVE_FOLDER):
        if f.startswith("rec_") and f.endswith(".wav"):
            try:
                nums.append(int(f[4:-4]))
            except ValueError:
                pass
    return max(nums, default=-1) + 1


def save_wav(pcm, index):
    path = os.path.join(SAVE_FOLDER, f"rec_{index}.wav")
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(pcm)
    return path


def get_model():
    global whisper_model
    if whisper_model is None:
        print("Loading Whisper...")
        whisper_model = whisper.load_model("base")
    return whisper_model


def transcribe(wav_path, name):
    text = get_model().transcribe(wav_path, language="en")["text"].strip()
    with open(os.path.join(SAVE_FOLDER, name + ".txt"), "w") as f:
        f.write(text)
    return text


def save_ble_recording(pcm):
    idx = next_index()
    name = f"rec_{idx}"
    wav = save_wav(pcm, idx)
    set_ble(message="Transcribing...", list_updated=True)

    def work():
        try:
            transcribe(wav, name)
        except Exception as e:
            print(f"BLE transcribe failed: {e}")
        set_ble(message="Connected — recordings sync automatically", list_updated=True)

    threading.Thread(target=work, daemon=True).start()


# ── Bluetooth ─────────────────────────────────────────────
class BleRx:
    def __init__(self):
        self.lock = threading.Lock()
        self.buf = bytearray()
        self.active = False

ble_rx = BleRx()


def set_ble(connected=None, message=None, list_updated=None):
    with status_lock:
        if connected is not None:
            ble_status["connected"] = connected
        if message is not None:
            ble_status["message"] = message
        if list_updated is not None:
            ble_status["list_updated"] = list_updated


def finish_ble_recording():
    with ble_rx.lock:
        if not ble_rx.active:
            return
        pcm = bytes(ble_rx.buf)
        ble_rx.active = False
        ble_rx.buf = bytearray()

    if not pcm:
        return

    try:
        save_ble_recording(pcm)
    except Exception as e:
        print(f"BLE save failed: {e}")
        set_ble(message=f"Error saving recording: {e}")


def schedule_finish():
    threading.Timer(0.3, finish_ble_recording).start()


def on_meta(sender, data):
    if len(data) < 4:
        return
    with ble_rx.lock:
        ble_rx.buf = bytearray()
        ble_rx.active = True
    set_ble(message="Receiving recording...")


def on_audio(sender, data):
    with ble_rx.lock:
        if ble_rx.active:
            ble_rx.buf.extend(data)


def on_ctrl(sender, data):
    if data and data[0] == 0xFF:
        schedule_finish()


def is_recorder(device, adv):
    names = [device.name or "", getattr(adv, "local_name", None) or ""]
    for name in names:
        lower = name.lower()
        if "notebook" in lower or lower == DEVICE_NAME.lower():
            return True
    uuids = [u.lower() for u in (getattr(adv, "service_uuids", None) or [])]
    return SERVICE_UUID.lower() in uuids


async def ble_loop():
    while True:
        set_ble(connected=False, message="Scanning for Notebook Recorder...")
        device = None
        try:
            found = await BleakScanner.discover(timeout=10.0, return_adv=True)
            for dev, adv in found.values():
                if is_recorder(dev, adv):
                    device = dev
                    break
        except Exception as e:
            set_ble(message=f"Bluetooth error: {e}")
            await asyncio.sleep(5)
            continue

        if not device:
            await asyncio.sleep(2)
            continue

        try:
            async with BleakClient(device, timeout=20.0) as client:
                await client.start_notify(META_UUID, on_meta)
                await client.start_notify(AUDIO_UUID, on_audio)
                await client.start_notify(CTRL_UUID, on_ctrl)
                await client.write_gatt_char(CTRL_UUID, BLE_READY, response=True)
                set_ble(connected=True, message="Connected — recordings sync automatically")
                while client.is_connected:
                    await asyncio.sleep(1)
        except Exception as e:
            print(f"BLE disconnected: {e}")
            set_ble(connected=False, message="Reconnecting...")
            await asyncio.sleep(3)


def start_ble():
    if not BLE_OK:
        return

    def run():
        asyncio.run(ble_loop())

    threading.Thread(target=run, daemon=True).start()


# ── USB sync ──────────────────────────────────────────────
def read_line(ser):
    return ser.readline().decode(errors="replace").strip()


def read_bytes(ser, n):
    data = b""
    while len(data) < n:
        chunk = ser.read(n - len(data))
        if not chunk:
            raise serial.SerialException("Connection lost during download")
        data += chunk
    return data


def ask_count(ser):
    for _ in range(5):
        ser.reset_input_buffer()
        ser.write(b"SYNC\n")
        ser.flush()
        deadline = time.time() + 10
        while time.time() < deadline:
            line = read_line(ser)
            if line.startswith("COUNT:"):
                return int(line.split(":")[1])
    return None


def set_status(running, message):
    global sync_status
    sync_status = {"running": running, "message": message}


def do_sync():
    ser = None
    set_status(True, "Connecting...")
    try:
        port = find_port()
        if not port:
            set_status(False, "Board not found — plug it in and try again")
            return

        ser = serial.Serial(port, BAUD_RATE, timeout=30)
        time.sleep(2)
        ser.reset_input_buffer()

        set_status(True, "Requesting recordings...")
        count = ask_count(ser)
        if count is None:
            set_status(False, "No response — close Serial Monitor, press RESET, try again")
            return
        if count == 0:
            read_line(ser)  # SYNCDONE
            set_status(False, "No recordings on board")
            return

        idx = next_index()
        synced = 0

        for n in range(count):
            header = read_line(ser)
            if not header.startswith("FILE:"):
                break
            size = int(header.split(":")[2])
            name = f"rec_{idx}"

            set_status(True, f"Downloading {name} ({n + 1}/{count})...")
            pcm = read_bytes(ser, size)
            read_line(ser)  # EOF

            wav = save_wav(pcm, idx)
            set_status(True, f"Transcribing {name} ({n + 1}/{count})...")
            transcribe(wav, name)

            idx += 1
            synced += 1

        read_line(ser)  # SYNCDONE
        ser.write(b"CLEAR\n")
        read_line(ser)  # CLEARED
        set_status(False, f"Done! {synced} recording(s) synced.")

    except serial.SerialException as e:
        busy = "busy" in str(e).lower() or getattr(e, "errno", None) == 16
        msg = "Port busy — close Arduino Serial Monitor and try again" if busy else str(e)
        set_status(False, msg)
    except Exception as e:
        set_status(False, f"Error: {e}")
    finally:
        if ser and ser.is_open:
            ser.close()


if __name__ == "__main__":
    start_ble()
    webbrowser.open("http://localhost:5000")
    app.run(port=5000)
