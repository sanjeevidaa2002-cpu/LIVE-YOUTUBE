# StreamLoop 24×7 - YouTube RTMP Video Loop Streaming Engine

A production-ready, full-stack application that enables authenticated users to upload video files and broadcast them in an endless, continuous 24×7 loop directly to YouTube Live via server-side FFmpeg processes.

---

## Key Features

1. **True Server-Side Persistence**: The livestream is executed as an isolated background FFmpeg process (`child_process.spawn`) on the server. Closing the browser or losing client internet connection has zero effect on the livestream.
2. **Endless Video Looping**: Utilizes `-stream_loop -1` combined with YouTube-standard FLV muxing (`-f flv`) to provide continuous, seamless looping without dropped frames.
3. **Auto-Reconnect & Auto-Recovery**:
   - Reconnects automatically to YouTube RTMP if connection is temporarily dropped.
   - Restores and relaunches any active stream if the server host or container reboots.
4. **Secure Stream Key Handling**: YouTube stream keys are stored securely on the backend and masked in all API responses and logs. FFmpeg is executed with argument arrays to prevent command injection vulnerabilities.
5. **Real-time Telemetry & Live Logs**:
   - Live stream duration and loop iteration counter.
   - Real-time encoder metrics: FPS, Bitrate, Encoding speed, and Total frames.
   - Live SSE-powered terminal streaming STDIN/STDOUT logs with search and filter capabilities.
6. **Video Library & Metadata**: Automatic thumbnail generation and duration/resolution/FPS/codec extraction using FFprobe.
7. **System Diagnostics**: Server CPU, RAM usage, storage breakdown, and binary availability checks for FFmpeg and FFprobe.

---

## Default Admin Credentials

- **Username**: `admin`
- **Password**: `admin123` *(Can be updated from the Settings page)*

---

## YouTube Stream Configuration

1. Go to [YouTube Studio Live Dashboard](https://studio.youtube.com/channel/live).
2. Click **Go Live** and select **Stream**.
3. Copy your **Stream URL** (`rtmp://a.rtmp.youtube.com/live2`) and **Stream Key**.
4. In StreamLoop, upload your video, paste your stream key, choose your preferred quality/bitrate, and click **START STREAM**.

---

## Deployment Options

### 1. Docker & Docker Compose (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d --build

# View container logs
docker-compose logs -f
```

### 2. Linux VPS (Ubuntu / Debian) with PM2 & Systemd

```bash
# 1. Install Node.js 20 & FFmpeg
sudo apt update
sudo apt install -y nodejs npm ffmpeg

# 2. Clone repository & install dependencies
npm install

# 3. Build frontend & backend
npm run build

# 4. Start with PM2
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

---

## Architecture

- **Backend**: Express + Node.js with native TypeScript build via `esbuild`.
- **Streaming Engine**: `StreamingService` singleton managing persistent FFmpeg process lifecycles.
- **Frontend**: React 19 + Vite + Tailwind CSS + Lucide Icons.
- **Real-Time Layer**: Server-Sent Events (`/api/stream/events`) for log streaming and encoder telemetry.
