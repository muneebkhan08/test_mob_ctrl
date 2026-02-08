# Deployment Guide — SPIDER_CTRL Remote

Complete step-by-step guide to deploy the frontend on **Vercel** and run the backend server on your PC.

---

## Part 1: Deploy Frontend to Vercel

### Prerequisites

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free tier works)
- Repository pushed to GitHub (already done → `muneebkhan08/mob_ctrl`)

---

### Step 1 — Import Project in Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click **"Add New…"** → **"Project"**
3. Under **"Import Git Repository"**, find and select **`muneebkhan08/mob_ctrl`**
4. Click **"Import"**

---

### Step 2 — Configure Project Settings

On the **"Configure Project"** page, set the following:

| Setting | Value |
| --- | --- |
| **Project Name** | `spider-ctrl` (or any name you prefer) |
| **Framework Preset** | **Next.js** |
| **Root Directory** | `frontend` ← ⚠️ **Critical — click "Edit" and type `frontend`** |
| **Build Command** | `next build` (auto-detected, leave default) |
| **Output Directory** | `.next` (auto-detected, leave default) |
| **Install Command** | `npm install` (auto-detected, leave default) |
| **Node.js Version** | `20.x` (default is fine) |

#### How to set Root Directory

1. In the **"Configure Project"** screen, find **"Root Directory"**
2. Click the **"Edit"** button next to it
3. Type **`frontend`** in the text field
4. You should see it detect `package.json` inside `frontend/`
5. Confirm the selection

> **Why?** The repo has both `frontend/` and `server/` folders. Vercel only needs to build the Next.js app inside `frontend/`.

---

### Step 3 — Environment Variables (Optional)

No environment variables are required for the basic setup. The WebSocket server IP is entered manually in the app's UI.

If you want to set a default server IP:

| Key | Value | Example |
| --- | --- | --- |
| `NEXT_PUBLIC_DEFAULT_SERVER_IP` | Your PC's static LAN IP | `192.168.1.42` |

> This is optional. You can always type the IP manually in the app.

---

### Step 4 — Deploy

1. Click **"Deploy"**
2. Wait for the build to complete (usually 30–60 seconds)
3. You'll see a success screen with your deployment URL

Your app is now live at:

```text
https://spider-ctrl.vercel.app
```

(or whatever project name you chose)

---

### Step 5 — Verify Deployment

1. Open the Vercel URL on your phone's browser
2. You should see the SPIDER_CTRL app with:
   - The connection bar at the top
   - Bottom tab navigation (Pad / Keys / Tools / Control)
3. The app will show "Disconnected" — that's expected until you start the server

---

## Part 2: Set Up the PC Server

The Python server runs **locally on your PC** — it is NOT deployed to Vercel.

### Step 1 — Install Python Dependencies

```bash
cd server

# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate           # Windows (Command Prompt)
# or
.\venv\Scripts\Activate.ps1     # Windows (PowerShell)
# or
source venv/bin/activate        # Mac/Linux

# Install packages
pip install -r requirements.txt
```

### Step 2 — Start the Server

```bash
python server.py
```

Or simply double-click **`start-server.bat`** from the project root.

You'll see:

```text
════════════════════════════════════════════════════════
  🖥️  SPIDER_CTRL Server v1.0.0
  🌐  WebSocket  →  ws://192.168.1.42:8765/ws
  📡  UDP Disco   →  port 8766
  💻  Platform    →  Windows 10
════════════════════════════════════════════════════════
```

**Note the IP address** — you'll need it on your phone.

### Step 3 — Allow Through Firewall (if needed)

If your phone can't connect, Windows Firewall may be blocking the server:

1. Open **Windows Defender Firewall**
2. Click **"Allow an app or feature through Windows Defender Firewall"**
3. Click **"Change settings"** → **"Allow another app…"**
4. Browse to `server\venv\Scripts\python.exe`
5. Check both **Private** and **Public** networks
6. Click **OK**

Alternatively, run in an elevated PowerShell:

```powershell
New-NetFirewallRule -DisplayName "SPIDER_CTRL Server" -Direction Inbound -Protocol TCP -LocalPort 8765 -Action Allow
New-NetFirewallRule -DisplayName "SPIDER_CTRL Discovery" -Direction Inbound -Protocol UDP -LocalPort 8766 -Action Allow
```

---

## Part 3: Connect Phone to PC

### Both on Same Wi-Fi

1. Open `https://spider-ctrl.vercel.app` on your phone
2. Tap the connection bar → expand it
3. Enter your PC's IP (e.g., `192.168.1.42`)
4. Tap **Connect**
5. Status turns green → you're in! ✅

### Using PC as Hotspot

1. **PC:** Settings → Network → Mobile Hotspot → Turn On
2. **Phone:** Connect to the PC's hotspot
3. **PC IP is usually:** `192.168.137.1`
4. Enter that IP in the app and connect

### Using Phone as Hotspot

1. **Phone:** Enable hotspot
2. **PC:** Connect to the phone's hotspot
3. Start the server → note the IP shown in console
4. Enter that IP in the app

---

## Part 4: Add to Home Screen (PWA)

For a native app-like experience on your phone:

### iOS (Safari)

1. Open the Vercel URL in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down → tap **"Add to Home Screen"**
4. Tap **"Add"**

### Android (Chrome)

1. Open the Vercel URL in Chrome
2. Tap the **⋮** menu (three dots)
3. Tap **"Add to Home screen"** or **"Install app"**
4. Tap **"Add"**

The app will now appear as an icon on your home screen and open in full-screen mode.

---

## Vercel Settings Summary

Quick reference for all Vercel configuration:

```text
Project Name:       spider-ctrl
Framework Preset:   Next.js
Root Directory:     frontend
Build Command:      next build         (default)
Output Directory:   .next              (default)
Install Command:    npm install        (default)
Node.js Version:    20.x               (default)
Env Variables:      none required
```

---

## Troubleshooting

| Problem | Solution |
| --- | --- |
| Vercel build fails | Ensure **Root Directory** is set to `frontend` |
| "Connection failed" on phone | Check both devices are on the same network |
| Firewall blocking | Allow `python.exe` through Windows Firewall (see Step 3 above) |
| Can't find PC IP | Look at the server console output when you start `server.py` |
| Touchpad not moving | Ensure the server console shows "Client connected" |
| App shows blank page | Clear browser cache and reload |
| WebSocket timeout | Try using the PC's hotspot instead of router Wi-Fi |

---

## Redeployment

Vercel auto-deploys on every push to `main`:

```bash
git add .
git commit -m "update"
git push
```

Vercel will automatically rebuild and deploy within ~60 seconds.

To manually trigger a redeploy:

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Deployments** tab
4. Click **⋮** on the latest deployment → **"Redeploy"**
