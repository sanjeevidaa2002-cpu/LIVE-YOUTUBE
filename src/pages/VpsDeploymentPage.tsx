import React, { useState } from 'react';
import {
  Server,
  Terminal,
  ShieldCheck,
  Cpu,
  Copy,
  Check,
  Download,
  ExternalLink,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Play,
  RotateCcw
} from 'lucide-react';

export const VpsDeploymentPage: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const steps = [
    {
      title: '1. Connect to your VPS & Install Node.js + FFmpeg',
      description: 'Run this on your Ubuntu 22.04 / 24.04 or Debian VPS terminal via SSH:',
      code: `# Update repositories and install essential build tools
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ffmpeg build-essential

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify FFmpeg and Node.js installation
node -v
ffmpeg -version`,
    },
    {
      title: '2. Clone & Install StreamLoop',
      description: 'Clone the project files or copy the build folder to `/var/www/streamloop`:',
      code: `# Clone or copy your project repository
cd /var/www
git clone <your-repo-url> streamloop || mkdir -p streamloop
cd streamloop

# Install production dependencies
npm install

# Build the frontend and backend server bundle
npm run build`,
    },
    {
      title: '3. Setup Systemd Service (Auto-Start on Boot & 24×7 Persistence)',
      description: 'Create a Linux systemd service so the app and stream restarts automatically if the server reboots:',
      code: `sudo tee /etc/systemd/system/streamloop.service > /dev/null <<EOF
[Unit]
Description=StreamLoop 24/7 YouTube RTMP Livestream Engine
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/streamloop
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable StreamLoop on boot
sudo systemctl daemon-reload
sudo systemctl enable streamloop
sudo systemctl start streamloop

# Check status
sudo systemctl status streamloop`,
    },
    {
      title: '4. Alternative: Run via PM2 Process Manager',
      description: 'If you prefer PM2 for background process supervision:',
      code: `# Install PM2 globally
sudo npm install -g pm2

# Start StreamLoop under PM2
cd /var/www/streamloop
pm2 start npm --name "streamloop" -- start

# Save PM2 process list to auto-start on boot
pm2 save
pm2 startup`,
    },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Server className="h-4 w-4" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight sm:text-2xl">
            Linux VPS Deployment & 24×7 Background Guide
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Step-by-step instructions to deploy this application to your VPS so your YouTube livestreams run continuously without keeping any browser open.
        </p>
      </div>

      {/* Critical Highlight Banner */}
      <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-[#0d1424] to-[#0a0f1d] p-6 shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <ShieldCheck className="h-5 w-5" />
          <span>True Server-Side Architecture: Zero Browser Dependency</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          When deployed on your Linux VPS, StreamLoop spawns detached native <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300 font-mono">ffmpeg</code> background processes. Once you click <strong>START STREAM</strong>:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
            <span className="font-bold text-white block mb-1">1. Close Browser Anytime</span>
            <span className="text-slate-400">You can safely close Chrome, Firefox, or shut down your PC. The VPS streams continuously.</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
            <span className="font-bold text-white block mb-1">2. Auto-Looping Playlists</span>
            <span className="text-slate-400">Plays video 1 → video 2 → video 3 → video 4 → loops forever seamlessly in one broadcast.</span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
            <span className="font-bold text-white block mb-1">3. Auto-Reconnection</span>
            <span className="text-slate-400">If YouTube drops ingest for a second, the server automatically reconnects with zero intervention.</span>
          </div>
        </div>
      </div>

      {/* Deployment Steps Accordion / Cards */}
      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div key={idx} className="rounded-2xl border border-slate-800 bg-[#0c111d] p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <button
                onClick={() => copyToClipboard(step.code, idx)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
              >
                {copiedIndex === idx ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Commands</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-400">{step.description}</p>
            <div className="rounded-xl border border-slate-900 bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto">
              <pre>{step.code}</pre>
            </div>
          </div>
        ))}
      </div>

      {/* Recommended VPS Specs */}
      <div className="rounded-2xl border border-slate-800 bg-[#0c111d] p-5 shadow-lg space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Cpu className="h-4 w-4 text-indigo-400" />
          Recommended VPS Hardware Specifications for 1080p / 720p 24×7 Streams
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5">
            <span className="text-slate-400 block mb-1">CPU</span>
            <span className="font-bold text-white text-sm">2+ vCPU Cores</span>
            <p className="text-[11px] text-slate-400 mt-1">Sufficient for ultrafast/superfast H.264 video encoding</p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5">
            <span className="text-slate-400 block mb-1">RAM</span>
            <span className="font-bold text-white text-sm">2 GB - 4 GB RAM</span>
            <p className="text-[11px] text-slate-400 mt-1">Lightweight memory footprint (~150MB FFmpeg buffer)</p>
          </div>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5">
            <span className="text-slate-400 block mb-1">Bandwidth</span>
            <span className="font-bold text-white text-sm">10+ Mbps Upload</span>
            <p className="text-[11px] text-slate-400 mt-1">Constant bitrate egress to YouTube Live servers</p>
          </div>
        </div>
      </div>
    </div>
  );
};
