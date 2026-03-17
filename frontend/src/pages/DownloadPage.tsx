import {
  Download,
  Monitor,
  Smartphone,
  Wifi,
  HardDrive,
  RefreshCw,
  Shield,
} from 'lucide-react';

const features = [
  {
    icon: Smartphone,
    title: 'Auto-Detect Devices',
    description: 'Automatically detects Android phones connected via USB',
  },
  {
    icon: Download,
    title: 'ADB Auto-Install',
    description: 'Downloads and installs ADB drivers automatically if not found',
  },
  {
    icon: Wifi,
    title: 'VPS Bridge',
    description: 'Connects to your cloud dashboard with real-time heartbeat',
  },
  {
    icon: RefreshCw,
    title: 'Auto-Start on Boot',
    description: 'Starts automatically when Windows boots up',
  },
  {
    icon: HardDrive,
    title: 'Device Actions',
    description: 'Reboot, screenshot, shell commands from the dashboard',
  },
  {
    icon: Shield,
    title: 'Secure Connection',
    description: 'API key authentication between agent and server',
  },
];

export default function DownloadPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Download Windows Agent</h1>
        <p className="text-dark-400 mt-2 text-lg">
          Install the gateway agent on your Windows PC to connect Android devices
        </p>
      </div>

      {/* Download Card */}
      <div className="bg-gradient-to-br from-primary-600/20 via-dark-800 to-primary-800/10 rounded-2xl border border-primary-500/30 p-8 text-center">
        <div className="w-20 h-20 bg-primary-600/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Monitor className="w-10 h-10 text-primary-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Mobile Manager Agent v1.0.0</h2>
        <p className="text-dark-400 mb-1">Windows x64 Installer (NSIS)</p>
        <p className="text-dark-500 text-sm mb-6">73 MB &bull; Requires Windows 10 or later</p>
        <a
          href="/downloads/Mobile%20Manager%20Agent%20Setup%201.0.0.exe"
          className="inline-flex items-center gap-3 px-8 py-3.5 bg-primary-600 hover:bg-primary-700 text-white text-base font-semibold rounded-xl transition-colors shadow-lg shadow-primary-600/25"
        >
          <Download className="w-5 h-5" />
          Download Installer (.exe)
        </a>
      </div>

      {/* Features Grid */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">What&apos;s Included</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-dark-800 rounded-xl border border-dark-700 p-4"
              >
                <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary-400" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{feature.title}</h4>
                <p className="text-xs text-dark-400">{feature.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Setup Instructions */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Setup Guide</h3>
        <ol className="space-y-3">
          {[
            'Download and run the installer on your Windows PC',
            'The setup wizard will check for ADB — click "Download ADB" if not found',
            'Enter the Server URL and your Agent API Key (from the Agents page)',
            'Connect Android phones via USB with USB Debugging enabled',
            'Devices will automatically appear on this dashboard',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-primary-600/20 text-primary-400 rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              <span className="text-sm text-dark-300">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Server Info */}
      <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-3">Connection Details</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-dark-700">
            <span className="text-sm text-dark-400">Server URL</span>
            <code className="text-sm text-primary-400 bg-dark-900 px-3 py-1 rounded">
              {window.location.origin}
            </code>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-dark-400">API Key</span>
            <span className="text-sm text-dark-500">Get from Agents page after registering</span>
          </div>
        </div>
      </div>
    </div>
  );
}
