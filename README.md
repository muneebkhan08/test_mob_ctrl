# PC Control — Remote Desktop Controller

Control your PC/laptop from your phone over Wi-Fi. A lightweight, mobile-first remote control with trackpad, keyboard, power management, app launching, and more.

```text
┌─────────────────┐         WebSocket (ws://)         ┌──────────────┐
│   📱 Phone      │ ◄──────────────────────────────► │   🖥️ PC      │
│   (Browser)     │        Same Wi-Fi / Hotspot       │   (Server)   │
│                 │                                    │              │
│  Next.js App    │   ── mouse, keyboard, power ──►   │  Python      │
│  on Vercel      │   ◄── status, volume, info ───    │  FastAPI     │
└─────────────────┘                                    └──────────────┘
```

## ✨ Features

| Feature | Description |
| --------- | ------------- |
| 🖱️ **Touchpad** | Multi-touch trackpad — 1-finger move, 2-finger scroll, tap to click, 2-finger tap for right-click |
| ⌨️ **Keyboard** | Full text input, special keys (Esc, Tab, arrows, F1-F12), shortcuts (Ctrl+C/V/Z, Alt+Tab, etc.) |
| 🔌 **Power** | Shutdown, Restart, Sleep, Lock Screen, Log Out — with confirmation |
| 📱 **App Launcher** | Quick-launch 25+ common apps or run any custom command |
| 🔍 **Google Search** | Search Google or open any URL directly on your PC browser |
| 🔊 **Volume** | Visual volume control with slider, presets, and mute toggle |
| 🎵 **Media** | Play/Pause, Next, Previous, Stop — works with Spotify, YouTube, etc. |
| 📋 **Clipboard** | Get/set clipboard text remotely |

## 🏗️ Architecture

- **Frontend** — Next.js 14 + Tailwind CSS + Framer Motion (deployed on **Vercel**)
- **Backend** — Python FastAPI with WebSocket (runs **locally on your PC**)
- **Transport** — WebSocket over Wi-Fi (fast, bidirectional, easy to implement)
- **Discovery** — UDP broadcast so the server announces its IP on the network

## 🚀 Quick Start

### 1. Set up the PC Server

```bash
cd server

# Create virtual environment (recommended)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

# Install dependencies
pip install -r requirements.txt

# Start the server
python server.py
```

You'll see output like:

```text
════════════════════════════════════════════════════════
  🖥️  PC Control Server v1.0.0
  🌐  WebSocket  →  ws://192.168.1.42:8765/ws
  📡  UDP Disco   →  port 8766
  💻  Platform    →  Windows 10
════════════════════════════════════════════════════════
```

### 2. Set up the Frontend

#### Option A: Use the deployed Vercel app

Once deployed (see Deployment section), just open the URL on your phone.

#### Option B: Run locally for development

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` on your phone (both devices must be on the same network).

### 3. Connect

1. Open the app on your phone
2. Tap the connection bar and enter your PC's IP address (shown in the server console)
3. Tap **Connect**
4. Start controlling your PC! 🎉

## 📦 Deploy Frontend to Vercel

### Step-by-step

1. **Push to GitHub**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/pc-control.git
   git push -u origin main
   ```

2. **Import in Vercel**
   - Go to [vercel.com](https://vercel.com) → New Project
   - Import your GitHub repo
   - Set the **Root Directory** to `frontend`
   - Framework Preset: **Next.js** (auto-detected)
   - Click **Deploy**

3. **Access from phone**
   - Open `https://your-app.vercel.app` on your phone's browser
   - Enter your PC's local IP and connect

> **Note:** The Vercel frontend connects to your PC's local server via WebSocket. Both your phone and PC must be on the same Wi-Fi network or hotspot.

## 🌐 Network Setup

### Same Wi-Fi

Both phone and PC on the same router. Enter the PC's local IP (e.g., `192.168.1.x`).

### PC as Hotspot

1. Enable Mobile Hotspot on your PC (Settings → Network → Mobile Hotspot)
2. Connect your phone to the PC's hotspot
3. Use the PC's hotspot IP (usually `192.168.137.1`)

### Phone as Hotspot

1. Enable hotspot on your phone
2. Connect your PC to the phone's hotspot
3. Find the PC's IP from the server console output

## 📁 Project Structure

```text
pc_control/
├── frontend/                    # Next.js app (→ Vercel)
│   ├── app/
│   │   ├── page.tsx            # Main app shell with tabs
│   │   ├── layout.tsx          # Root layout + PWA meta
│   │   ├── globals.css         # Tailwind + custom styles
│   │   ├── hooks/
│   │   │   └── useWebSocket.tsx    # WebSocket context + hook
│   │   └── components/
│   │       ├── ConnectionBar.tsx   # Connect/disconnect UI
│   │       ├── Touchpad.tsx        # Multi-touch trackpad
│   │       ├── Keyboard.tsx        # Virtual keyboard + shortcuts
│   │       ├── PowerControls.tsx   # Power actions
│   │       ├── AppLauncher.tsx     # App grid launcher
│   │       ├── GoogleSearch.tsx    # Search + URL opener
│   │       └── MediaVolume.tsx     # Volume + media controls
│   ├── public/
│   │   └── manifest.json          # PWA manifest
│   ├── package.json
│   ├── tailwind.config.js
│   └── next.config.js
│
├── server/                      # Python server (runs on PC)
│   ├── server.py               # FastAPI + WebSocket + UDP discovery
│   ├── requirements.txt
│   ├── controllers/
│   │   ├── mouse.py            # Mouse move, click, scroll, drag
│   │   ├── keyboard.py         # Key press, combos, text typing
│   │   ├── power.py            # Shutdown, restart, sleep, lock
│   │   ├── apps.py             # App launching + process management
│   │   ├── search.py           # Google search + URL opening
│   │   ├── volume.py           # System volume (pycaw)
│   │   ├── media.py            # Media keys (play, next, etc.)
│   │   ├── clipboard.py        # Clipboard get/set
│   │   └── system_info.py      # CPU, RAM, battery info
│   └── utils/
│       └── network.py          # IP detection helpers
│
└── README.md
```

## 🔧 WebSocket Protocol

All messages are JSON with this format:

```json
// Client → Server
{
  "action": "mouse_move",
  "payload": { "dx": 10, "dy": -5 },
  "id": "req_1"          // optional, for request-response
}

// Server → Client
{
  "ok": true,
  "data": { "moved": [10, -5] },
  "id": "req_1"
}
```

### Available Actions

| Action | Payload | Description |
| -------- | --------- | ------------- |
| `mouse_move` | `{dx, dy}` | Move cursor relatively |
| `mouse_click` | `{button}` | Click (left/right/middle) |
| `mouse_double_click` | — | Double click |
| `mouse_right_click` | — | Right click |
| `mouse_scroll` | `{dx, dy}` | Scroll |
| `key_press` | `{key}` | Press a key |
| `key_combo` | `{keys: [...]}` | Key combination |
| `key_type` | `{text}` | Type text string |
| `power_shutdown` | `{delay?}` | Shutdown PC |
| `power_restart` | `{delay?}` | Restart PC |
| `power_sleep` | — | Sleep PC |
| `power_lock` | — | Lock screen |
| `power_logout` | — | Log out |
| `app_open` | `{name}` | Open application |
| `app_list` | — | List available apps |
| `google_search` | `{query}` | Google search |
| `url_open` | `{url}` | Open URL in browser |
| `volume_set` | `{level}` | Set volume (0-100) |
| `volume_get` | — | Get current volume |
| `volume_mute` | — | Toggle mute |
| `media_play_pause` | — | Play/Pause media |
| `media_next` | — | Next track |
| `media_prev` | — | Previous track |
| `system_info` | — | Get PC info |

## ⚠️ Security Notes

- The server binds to `0.0.0.0` — it's accessible to anyone on the same network
- **Only run the server on trusted networks** (home Wi-Fi, personal hotspot)
- No authentication is implemented — add a PIN/token for shared networks
- The WebSocket connection is unencrypted (`ws://`), not `wss://`

## 📄 License

MIT — Use freely, modify as needed.
#   m o b _ c t r l  
 #   t e s t _ m o b _ c t r l  
 