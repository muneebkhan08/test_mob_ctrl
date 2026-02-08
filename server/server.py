"""
PC Control Server — Main Entry Point
Runs a FastAPI WebSocket server + UDP broadcast for auto-discovery.
Also serves the frontend static files so everything runs from one server.
"""

import asyncio
import json
import os
import socket
import struct
import sys
import threading
import time
import platform
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from controllers.mouse import MouseController
from controllers.keyboard import KeyboardController
from controllers.power import PowerController
from controllers.apps import AppController
from controllers.search import SearchController
from controllers.volume import VolumeController
from controllers.media import MediaController
from controllers.clipboard import ClipboardController
from controllers.system_info import SystemInfoController
from utils.network import get_local_ip

# ── Constants ────────────────────────────────────────────────────────────────
SERVER_PORT = 8765
UDP_PORT = 8766
BROADCAST_INTERVAL = 2  # seconds
APP_NAME = "PC Control Server"
PROTOCOL_VERSION = "1.0.0"


# ── Controller Instances ─────────────────────────────────────────────────────
mouse = MouseController()
keyboard = KeyboardController()
power = PowerController()
apps = AppController()
search = SearchController()
volume = VolumeController()
media = MediaController()
clipboard = ClipboardController()
system_info = SystemInfoController()

# ── Route Dispatch Table ─────────────────────────────────────────────────────
HANDLERS = {
    # Mouse
    "mouse_move": mouse.move,
    "mouse_click": mouse.click,
    "mouse_double_click": mouse.double_click,
    "mouse_right_click": mouse.right_click,
    "mouse_scroll": mouse.scroll,
    "mouse_drag_start": mouse.drag_start,
    "mouse_drag_move": mouse.drag_move,
    "mouse_drag_end": mouse.drag_end,
    # Keyboard
    "key_press": keyboard.press,
    "key_combo": keyboard.combo,
    "key_type": keyboard.type_text,
    # Power
    "power_shutdown": power.shutdown,
    "power_restart": power.restart,
    "power_sleep": power.sleep,
    "power_lock": power.lock,
    "power_logout": power.logout,
    # Apps
    "app_open": apps.open_app,
    "app_list": apps.list_apps,
    "app_close": apps.close_app,
    # Search
    "google_search": search.google_search,
    "url_open": search.open_url,
    # Volume
    "volume_set": volume.set_volume,
    "volume_get": volume.get_volume,
    "volume_mute": volume.toggle_mute,
    "volume_up": volume.volume_up,
    "volume_down": volume.volume_down,
    # Media
    "media_play_pause": media.play_pause,
    "media_next": media.next_track,
    "media_prev": media.prev_track,
    "media_stop": media.stop,
    # Clipboard
    "clipboard_get": clipboard.get_text,
    "clipboard_set": clipboard.set_text,
    # System Info
    "system_info": system_info.get_info,
}


# ── UDP Discovery Broadcast ─────────────────────────────────────────────────
def udp_broadcast_loop():
    """Broadcasts server presence on the local network every few seconds."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

    local_ip = get_local_ip()
    hostname = socket.gethostname()

    payload = json.dumps({
        "service": APP_NAME,
        "version": PROTOCOL_VERSION,
        "ip": local_ip,
        "port": SERVER_PORT,
        "hostname": hostname,
        "platform": platform.system(),
    }).encode("utf-8")

    print(f"  📡  UDP broadcast on port {UDP_PORT}  (IP: {local_ip})")

    while True:
        try:
            sock.sendto(payload, ("<broadcast>", UDP_PORT))
        except Exception:
            pass
        time.sleep(BROADCAST_INTERVAL)


# ── FastAPI App ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start UDP discovery in a daemon thread
    t = threading.Thread(target=udp_broadcast_loop, daemon=True)
    t.start()
    local_ip = get_local_ip()
    has_frontend = FRONTEND_DIR.exists()
    print("\n" + "═" * 56)
    print(f"  🖥️  {APP_NAME} v{PROTOCOL_VERSION}")
    if has_frontend:
        print(f"  🌐  Open on phone → http://{local_ip}:{SERVER_PORT}")
    else:
        print(f"  ⚠️  Frontend not built — run: cd frontend && npm run build")
    print(f"  🔌  WebSocket  →  ws://{local_ip}:{SERVER_PORT}/ws")
    print(f"  📡  UDP Disco   →  port {UDP_PORT}")
    print(f"  💻  Platform    →  {platform.system()} {platform.release()}")
    print("═" * 56 + "\n")
    yield


app = FastAPI(title=APP_NAME, version=PROTOCOL_VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "ip": get_local_ip(),
        "port": SERVER_PORT,
        "hostname": socket.gethostname(),
        "platform": platform.system(),
    }


# ── Static Frontend Serving ──────────────────────────────────────────────────
FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "out"


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    client = ws.client
    print(f"  ✅  Client connected: {client.host}:{client.port}")

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_json({"error": "Invalid JSON"})
                continue

            action = msg.get("action")
            payload = msg.get("payload", {})
            request_id = msg.get("id")

            handler = HANDLERS.get(action)
            if handler is None:
                resp = {"error": f"Unknown action: {action}"}
            else:
                try:
                    result = handler(**payload) if payload else handler()
                    resp = {"ok": True, "data": result}
                except Exception as exc:
                    resp = {"ok": False, "error": str(exc)}

            if request_id is not None:
                resp["id"] = request_id

            await ws.send_json(resp)

    except WebSocketDisconnect:
        print(f"  ❌  Client disconnected: {client.host}:{client.port}")
    except Exception as exc:
        print(f"  ⚠️  Error: {exc}")


# ── Serve Frontend ───────────────────────────────────────────────────────────
if FRONTEND_DIR.exists():
    # Serve Next.js static export from /frontend/out
    @app.get("/{path:path}")
    async def serve_frontend(path: str):
        """Serve the static frontend. Falls back to index.html for SPA routing."""
        file_path = FRONTEND_DIR / path
        if file_path.is_file():
            return FileResponse(file_path)
        # Try .html extension (Next.js exports pages as page.html)
        html_path = FRONTEND_DIR / f"{path}.html"
        if html_path.is_file():
            return FileResponse(html_path)
        # Fallback to index.html
        index_path = FRONTEND_DIR / "index.html"
        if index_path.is_file():
            return FileResponse(index_path)
        return {"error": "Frontend not built. Run: cd frontend && npm run build"}

    print(f"  📂  Frontend found at {FRONTEND_DIR}")
else:
    @app.get("/")
    async def no_frontend():
        return {
            "message": "PC Control Server is running. Frontend not found.",
            "hint": "Run: cd frontend && npm run build",
            "websocket": f"ws://{get_local_ip()}:{SERVER_PORT}/ws",
        }


# ── Main ─────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=SERVER_PORT,
        log_level="warning",
        reload=False,
    )
