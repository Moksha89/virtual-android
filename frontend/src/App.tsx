import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import {
  Smartphone,
  Tablet,
  Plus,
  Trash2,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Monitor,
  RefreshCw,
  Loader2,
  Wifi,
  WifiOff,
  Zap,
  CircleDot,
  LogOut,
  Users,
  Shield,
  Edit,
  X,
  UserPlus,
  Eye,
  ChevronDown,
  Home,
  Square,
  Volume2,
  VolumeX,
  RotateCcw,
  Power,
  Camera,
  Keyboard,
  MapPin,
  Battery,
  Settings,
  Play,
  Type,
  ArrowLeft,
  Menu,
  Video,
  Lock,
  AlertTriangle,
  FolderOpen,
  Terminal,
  Package,
  ScrollText,
  Disc,
  Clipboard,
  Signal,
  CheckSquare,
  BarChart3,
  LayoutTemplate,
  Key,
  Bell,
  Save,
  Moon,
  Sun,
  Upload,
  Download,
  File,
  Folder,
  Search,
  Layers,
  Activity,
  Clock,
  Copy,
  MessageSquare,
  Phone,
  PhoneOff,
  Globe,
  Tag,
  Calendar,
  DollarSign,
  Webhook,
  Bug,
  Mic,
  MicOff,
  Brain,
  TestTube,
  Thermometer,
  Navigation,
  Languages,
  GitBranch,
  Hash,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  api,
  type HardwareProfile,
  type DeviceInfo,
  type ServerStatus,
  type AndroidVersion,
  type OSType,
  type User,
  type Assignment,
} from "@/lib/api";

// --- Auth Context ---
interface AuthState {
  user: User | null;
  token: string | null;
}

const AuthContext = createContext<{
  auth: AuthState;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}>({
  auth: { user: null, token: null },
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("auth_user");
    if (token && userStr) {
      try {
        return { token, user: JSON.parse(userStr) };
      } catch {
        return { token: null, user: null };
      }
    }
    return { token: null, user: null };
  });

  const login = async (username: string, password: string) => {
    const resp = await api.login(username, password);
    localStorage.setItem("auth_token", resp.access_token);
    localStorage.setItem("auth_user", JSON.stringify(resp.user));
    setAuth({ token: resp.access_token, user: resp.user });
  };

  const register = async (username: string, email: string, password: string) => {
    const resp = await api.register(username, email, password);
    localStorage.setItem("auth_token", resp.access_token);
    localStorage.setItem("auth_user", JSON.stringify(resp.user));
    setAuth({ token: resp.access_token, user: resp.user });
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    setAuth({ token: null, user: null });
  };

  return (
    <AuthContext.Provider value={{ auth, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    {
      variant: "default" | "secondary" | "destructive" | "outline";
      icon: React.ReactNode;
      label: string;
    }
  > = {
    running: {
      variant: "default",
      icon: <Wifi className="w-3 h-3" />,
      label: "Running",
    },
    starting: {
      variant: "secondary",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
      label: "Starting",
    },
    stopped: {
      variant: "outline",
      icon: <WifiOff className="w-3 h-3" />,
      label: "Stopped",
    },
    error: {
      variant: "destructive",
      icon: <WifiOff className="w-3 h-3" />,
      label: "Error",
    },
  };
  const c = config[status] || config.stopped;
  return (
    <Badge variant={c.variant} className="gap-1">
      {c.icon} {c.label}
    </Badge>
  );
}

function ProfileIcon({ category }: { category: string }) {
  if (category === "tablet") return <Tablet className="w-8 h-8" />;
  return <Smartphone className="w-8 h-8" />;
}

function ServerStatusPanel({ status }: { status: ServerStatus | null }) {
  if (!status)
    return (
      <div className="text-sm text-muted-foreground">
        Loading server status...
      </div>
    );
  const ramPercent =
    status.ram_total_gb > 0
      ? (status.ram_used_gb / status.ram_total_gb) * 100
      : 0;
  const diskPercent =
    status.disk_total_gb > 0
      ? (status.disk_used_gb / status.disk_total_gb) * 100
      : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
      <Card>
        <CardContent className="pt-3 pb-2 sm:pt-4 sm:pb-3">
          <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
            <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-500" />
            <span className="text-xs sm:text-sm font-medium">CPU</span>
          </div>
          <div className="text-lg sm:text-2xl font-bold">{status.cpu_cores} Cores</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">
            {status.cpu_usage_percent}% usage
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <MemoryStick className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">RAM</span>
          </div>
          <div className="text-2xl font-bold">
            {status.ram_used_gb}GB{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {status.ram_total_gb}GB
            </span>
          </div>
          <Progress value={ramPercent} className="mt-2 h-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">Disk</span>
          </div>
          <div className="text-2xl font-bold">
            {status.disk_used_gb}GB{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {status.disk_total_gb}GB
            </span>
          </div>
          <Progress value={diskPercent} className="mt-2 h-2" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">GPU</span>
          </div>
          <div className="text-lg font-bold truncate">
            {status.gpu_name || "N/A"}
          </div>
          <div className="text-xs text-muted-foreground">
            {status.gpu_memory_total_mb > 0
              ? `${status.gpu_memory_used_mb}MB / ${status.gpu_memory_total_mb}MB`
              : "No GPU detected"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Login Page ---
function LoginPage() {
  const { login, register: doRegister } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await doRegister(username, email, password);
      } else {
        await login(username, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="mx-auto p-3 rounded-xl bg-blue-600 text-white w-fit mb-2">
            <Server className="w-8 h-8" />
          </div>
          <CardTitle className="text-2xl">Cuttlefish Device Manager</CardTitle>
          <CardDescription>
            {isRegister ? "Create your account" : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                required
              />
            </div>
            {isRegister && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {isRegister ? "Create Account" : "Sign In"}
            </Button>
            <div className="text-center text-sm text-gray-500">
              {isRegister ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setIsRegister(false)}
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    className="text-blue-600 hover:underline"
                    onClick={() => setIsRegister(true)}
                  >
                    Register
                  </button>
                </>
              )}
            </div>
            {!isRegister && (
              <div className="text-center text-xs text-gray-400">
                Default admin: admin / admin123
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Device Control Button ---
function ControlButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className = "",
  size = "default",
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg";
}) {
  const sizeClasses = {
    sm: "w-8 h-8",
    default: "w-10 h-10",
    lg: "w-12 h-12",
  };
  const iconSizes = {
    sm: "w-3.5 h-3.5",
    default: "w-4 h-4",
    lg: "w-5 h-5",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`${sizeClasses[size]} flex items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm ${className}`}
    >
      <Icon className={iconSizes[size]} />
    </button>
  );
}

// --- Screen Viewer Dialog with Genymotion-like Controls ---
function ScreenViewerDialog({
  device,
  open,
  onClose,
}: {
  device: DeviceInfo;
  open: boolean;
  onClose: () => void;
}) {
  const screenUrl = `https://${device.ip}:${device.webrtc_port}`;
  const [sending, setSending] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [statusMsg, setStatusMsg] = useState("");
  const textInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const sendControl = async (action: string, params: Record<string, unknown> = {}) => {
    setSending(true);
    setStatusMsg("");
    try {
      await api.deviceControl(device.id, action, params);
      setStatusMsg("OK");
      setTimeout(() => setStatusMsg(""), 1500);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Command failed");
    } finally {
      setSending(false);
    }
  };

  const handleKeyEvent = (keycode: string) => sendControl("keyevent", { keycode });

  const handleTextSend = async () => {
    if (!textInput.trim()) return;
    await sendControl("text", { text: textInput });
    setTextInput("");
  };

  const handleRotation = async () => {
    const newOrientation = orientation === "portrait" ? "landscape" : "portrait";
    await sendControl("rotation", { orientation: newOrientation });
    setOrientation(newOrientation);
  };

  const handleKeyboardInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleTextSend();
    }
  };

  const toggleCamera = async () => {
    if (showCamera) {
      // Stop camera
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setShowCamera(false);
    } else {
      // Start camera
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        cameraStreamRef.current = stream;
        setShowCamera(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        }, 100);
      } catch {
        setStatusMsg("Camera access denied or unavailable");
      }
    }
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[98vw] md:max-w-5xl max-h-[98vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-3 md:px-4 pt-3 pb-2 shrink-0 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-sm md:text-base truncate">{device.name}</DialogTitle>
              <DialogDescription className="text-xs truncate">
                {device.profile_name} | ADB: {device.ip}:{device.adb_port}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {statusMsg && (
                <span className={`text-xs max-w-[150px] truncate ${statusMsg === "OK" ? "text-green-600" : "text-red-500"}`}>{statusMsg}</span>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Screen Area */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
          {showCamera ? (
            <div className="w-full h-full flex items-center justify-center bg-black" style={{ minHeight: "250px", height: "calc(98vh - 220px)" }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="max-w-full max-h-full object-contain"
              />
            </div>
          ) : (
            <iframe
              src={screenUrl}
              className="w-full h-full border-0"
              style={{ minHeight: "250px", height: "calc(98vh - 220px)" }}
              allow="autoplay; clipboard-write; camera; microphone"
              title={`${device.name} Screen`}
            />
          )}
        </div>

        {/* Control Bar - Always visible below screen */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50">
          {/* Navigation row - Back / Home / Recent */}
          <div className="flex items-center justify-center gap-3 px-2 py-1.5 border-b border-gray-100">
            <button
              onClick={() => handleKeyEvent("KEYCODE_BACK")}
              disabled={sending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={() => handleKeyEvent("KEYCODE_HOME")}
              disabled={sending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 shadow-sm"
            >
              <Home className="w-4 h-4" /> Home
            </button>
            <button
              onClick={() => handleKeyEvent("KEYCODE_APP_SWITCH")}
              disabled={sending}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 shadow-sm"
            >
              <Square className="w-4 h-4" /> Recent
            </button>
          </div>

          {/* All control buttons - wrapping grid */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 px-2 py-2">
            <ControlButton icon={Volume2} label="Volume Up" onClick={() => handleKeyEvent("KEYCODE_VOLUME_UP")} disabled={sending} size="sm" />
            <ControlButton icon={VolumeX} label="Volume Down" onClick={() => handleKeyEvent("KEYCODE_VOLUME_DOWN")} disabled={sending} size="sm" />
            <ControlButton icon={Power} label="Power" onClick={() => handleKeyEvent("KEYCODE_POWER")} disabled={sending} size="sm" />
            <ControlButton icon={RotateCcw} label={`Rotate (${orientation})`} onClick={handleRotation} disabled={sending} size="sm" />
            <ControlButton icon={Camera} label="Screenshot" onClick={() => sendControl("screenshot")} disabled={sending} size="sm" />
            <ControlButton
              icon={Video}
              label={showCamera ? "Stop Camera" : "Camera"}
              onClick={toggleCamera}
              disabled={sending}
              size="sm"
              className={showCamera ? "bg-red-50 border-red-300" : ""}
            />
            <ControlButton
              icon={Keyboard}
              label="Toggle Keyboard"
              onClick={() => {
                setShowKeyboard(!showKeyboard);
                if (!showKeyboard) {
                  setTimeout(() => textInputRef.current?.focus(), 100);
                }
              }}
              disabled={sending}
              size="sm"
              className={showKeyboard ? "bg-blue-50 border-blue-300" : ""}
            />
            <ControlButton icon={Settings} label="Open Settings" onClick={() => sendControl("open_settings")} disabled={sending} size="sm" />
            <ControlButton icon={Play} label="Open Play Store" onClick={() => sendControl("open_playstore")} disabled={sending} size="sm" />
            <ControlButton icon={MapPin} label="Set GPS" onClick={() => sendControl("gps", { latitude: 37.4220, longitude: -122.0841 })} disabled={sending} size="sm" />
            <ControlButton icon={Battery} label="Battery 50%" onClick={() => sendControl("battery", { level: 50 })} disabled={sending} size="sm" />
            <ControlButton icon={Menu} label="Menu" onClick={() => handleKeyEvent("KEYCODE_MENU")} disabled={sending} size="sm" />
          </div>
        </div>

        {/* Keyboard input bar */}
        {showKeyboard && (
          <div className="px-2 sm:px-3 py-2 border-t border-gray-200 bg-white shrink-0 space-y-2">
            <div className="flex gap-1.5 sm:gap-2">
              <Input
                ref={textInputRef}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyboardInput}
                placeholder="Type text to send..."
                className="flex-1 text-sm h-8 sm:h-9"
                autoFocus
              />
              <Button size="sm" onClick={handleTextSend} disabled={sending || !textInput.trim()} className="h-8 sm:h-9 px-2 sm:px-3">
                <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline ml-1">Send</span>
              </Button>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleKeyEvent("KEYCODE_SEARCH")}
                disabled={sending}
                className="flex-1 h-7 text-xs"
              >
                <Keyboard className="w-3 h-3 mr-1" /> Show Keyboard
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleKeyEvent("KEYCODE_BACK")}
                disabled={sending}
                className="flex-1 h-7 text-xs"
              >
                Hide Keyboard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Edit Device Dialog ---
function EditDeviceDialog({
  device,
  open,
  onClose,
  onSaved,
}: {
  device: DeviceInfo;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(device.name);
  const [ramMb, setRamMb] = useState(device.ram_mb);
  const [storageGb, setStorageGb] = useState(device.storage_gb);
  const [cpus, setCpus] = useState(device.cpus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.editDevice(device.id, {
        name: name !== device.name ? name : undefined,
        ram_mb: ramMb !== device.ram_mb ? ramMb : undefined,
        storage_gb: storageGb !== device.storage_gb ? storageGb : undefined,
        cpus: cpus !== device.cpus ? cpus : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Device</DialogTitle>
          <DialogDescription>
            Update device settings. Note: RAM/Storage/CPU changes will apply on
            next restart.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Device Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>RAM</Label>
              <span className="text-sm font-medium">
                {ramMb >= 1024 ? `${(ramMb / 1024).toFixed(0)} GB` : `${ramMb} MB`}
              </span>
            </div>
            <Slider
              value={[ramMb]}
              onValueChange={([v]) => setRamMb(v)}
              min={1024}
              max={32768}
              step={1024}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Storage</Label>
              <span className="text-sm font-medium">{storageGb} GB</span>
            </div>
            <Slider
              value={[storageGb]}
              onValueChange={([v]) => setStorageGb(v)}
              min={8}
              max={512}
              step={8}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>CPU Cores</Label>
              <span className="text-sm font-medium">{cpus}</span>
            </div>
            <Slider
              value={[cpus]}
              onValueChange={([v]) => setCpus(v)}
              min={1}
              max={16}
              step={1}
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Admin Panel ---
function AdminPanel({
  devices,
  onRefresh,
}: {
  devices: DeviceInfo[];
  onRefresh: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [deletePasscode, setDeletePasscode] = useState("");
  const [savingPasscode, setSavingPasscode] = useState(false);
  const [passcodeMsg, setPasscodeMsg] = useState("");

  const loadAdmin = useCallback(async () => {
    try {
      const [u, a, pc] = await Promise.all([
        api.getUsers(),
        api.getAssignments(),
        api.getDeletePasscode(),
      ]);
      setUsers(u);
      setAssignments(a);
      setDeletePasscode(pc.passcode || "");
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const handleCreateUser = async () => {
    if (!newUsername || !newEmail || !newPassword) return;
    setCreating(true);
    try {
      await api.adminCreateUser(newUsername, newEmail, newPassword);
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setShowCreateUser(false);
      await loadAdmin();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRole = async (user: User) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    await api.updateUser(user.id, { role: newRole });
    await loadAdmin();
  };

  const handleToggleActive = async (user: User) => {
    await api.updateUser(user.id, { is_active: !user.is_active });
    await loadAdmin();
  };

  const handleDeleteUser = async (userId: number) => {
    await api.deleteUser(userId);
    await loadAdmin();
  };

  const handleAssign = async (deviceId: string, userId: number) => {
    try {
      await api.assignDevice(deviceId, userId);
      await loadAdmin();
      onRefresh();
    } catch {
      // ignore
    }
  };

  const handleUnassign = async (deviceId: string, userId: number) => {
    await api.unassignDevice(deviceId, userId);
    await loadAdmin();
    onRefresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Users Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" /> User Management
              </CardTitle>
              <CardDescription>{users.length} users</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setShowCreateUser(!showCreateUser)}
            >
              <UserPlus className="w-4 h-4 mr-1" /> Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreateUser && (
            <div className="p-3 sm:p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <Input
                  placeholder="Username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                />
                <Input
                  placeholder="Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
                <Input
                  placeholder="Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreateUser} disabled={creating}>
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Create User"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreateUser(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    User
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Email
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Role
                  </th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">
                    Active
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium">{u.username}</td>
                    <td className="px-4 py-2 text-gray-500">{u.email}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={u.role === "admin" ? "default" : "secondary"}
                        className="cursor-pointer"
                        onClick={() => handleToggleRole(u)}
                      >
                        {u.role === "admin" ? (
                          <Shield className="w-3 h-3 mr-1" />
                        ) : null}
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Switch
                        checked={u.is_active}
                        onCheckedChange={() => handleToggleActive(u)}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Device Assignments Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="w-5 h-5" /> Device Assignments
          </CardTitle>
          <CardDescription>
            Assign devices to users. Unassigned devices are visible to all
            users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {devices.map((device) => {
              const deviceAssignments = assignments.filter(
                (a) => a.device_id === device.id
              );
              const unassignedUsers = users.filter(
                (u) => !deviceAssignments.some((a) => a.user_id === u.id)
              );
              return (
                <div
                  key={device.id}
                  className="p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{device.name}</span>
                      <StatusBadge status={device.status} />
                    </div>
                    {unassignedUsers.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <UserPlus className="w-3.5 h-3.5 mr-1" /> Assign
                            <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Assign to user</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {unassignedUsers.map((u) => (
                            <DropdownMenuItem
                              key={u.id}
                              onClick={() => handleAssign(device.id, u.id)}
                            >
                              {u.username}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  {deviceAssignments.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {deviceAssignments.map((a) => (
                        <Badge
                          key={a.user_id}
                          variant="secondary"
                          className="gap-1"
                        >
                          {a.username}
                          <button
                            onClick={() =>
                              handleUnassign(device.id, a.user_id)
                            }
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 mt-1">
                      No users assigned — visible to everyone
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Delete Passcode Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="w-5 h-5" /> Delete Passcode
          </CardTitle>
          <CardDescription>
            Set a passcode required to delete devices. Leave empty to disable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="delete-passcode">Passcode</Label>
              <Input
                id="delete-passcode"
                type="text"
                placeholder="Enter passcode (leave empty to disable)"
                value={deletePasscode}
                onChange={(e) => setDeletePasscode(e.target.value)}
              />
            </div>
            <Button
              onClick={async () => {
                setSavingPasscode(true);
                setPasscodeMsg("");
                try {
                  await api.setDeletePasscode(deletePasscode);
                  setPasscodeMsg(deletePasscode ? "Passcode saved" : "Passcode disabled");
                  setTimeout(() => setPasscodeMsg(""), 3000);
                } catch {
                  setPasscodeMsg("Failed to save");
                } finally {
                  setSavingPasscode(false);
                }
              }}
              disabled={savingPasscode}
            >
              {savingPasscode ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Lock className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </div>
          {passcodeMsg && (
            <p className={`text-sm mt-2 ${passcodeMsg.includes("Failed") ? "text-red-600" : "text-green-600"}`}>
              {passcodeMsg}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Device Card ---
// --- Dark Mode Context ---
const DarkModeContext = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });
function useDarkMode() { return useContext(DarkModeContext); }
function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(() => localStorage.getItem("dark_mode") === "true");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dark_mode", String(dark));
  }, [dark]);
  return <DarkModeContext.Provider value={{ dark, toggle: () => setDark(p => !p) }}>{children}</DarkModeContext.Provider>;
}

// --- File Manager ---
function FileManagerDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [currentPath, setCurrentPath] = useState("/sdcard");
  const [files, setFiles] = useState<{ name: string; is_dir: boolean; size: number; permissions: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await api.listFiles(device.id, path);
      setFiles(res.files);
      setCurrentPath(path);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [device.id]);

  useEffect(() => { if (open) loadFiles(currentPath); }, [open]);

  const navigateTo = (name: string) => {
    const newPath = `${currentPath}/${name}`.replace(/\/+/g, "/");
    loadFiles(newPath);
  };
  const goBack = () => {
    const parent = currentPath.split("/").slice(0, -1).join("/") || "/";
    loadFiles(parent);
  };
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(",")[1];
      try { await api.uploadFile(device.id, currentPath, b64, file.name); loadFiles(currentPath); } catch (err) { console.error(err); }
    };
    reader.readAsDataURL(file);
  };
  const handleDownload = async (name: string) => {
    try {
      const res = await api.downloadFile(device.id, `${currentPath}/${name}`);
      const link = document.createElement("a");
      link.href = `data:application/octet-stream;base64,${res.data}`;
      link.download = res.filename;
      link.click();
    } catch (e) { console.error(e); }
  };
  const handleDelete = async (name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try { await api.deleteFile(device.id, `${currentPath}/${name}`); loadFiles(currentPath); } catch (e) { console.error(e); }
  };
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5" /> File Manager - {device.name}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm">
          <Button variant="ghost" size="sm" onClick={goBack} disabled={currentPath === "/"}><ArrowLeft className="w-4 h-4" /></Button>
          <code className="flex-1 truncate">{currentPath}</code>
          <label className="cursor-pointer">
            <input type="file" className="hidden" onChange={handleUpload} />
            <Button variant="outline" size="sm" asChild><span><Upload className="w-4 h-4 mr-1" /> Upload</span></Button>
          </label>
          <Button variant="ghost" size="sm" onClick={() => loadFiles(currentPath)}><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto border rounded">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : files.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Empty directory</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                <tr><th className="text-left p-2">Name</th><th className="text-right p-2 w-24">Size</th><th className="text-right p-2 w-20">Actions</th></tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.name} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="p-2">
                      {f.is_dir ? (
                        <button className="flex items-center gap-2 text-blue-600 hover:underline" onClick={() => navigateTo(f.name)}>
                          <Folder className="w-4 h-4" />{f.name}
                        </button>
                      ) : (
                        <span className="flex items-center gap-2"><File className="w-4 h-4 text-gray-400" />{f.name}</span>
                      )}
                    </td>
                    <td className="p-2 text-right text-gray-500">{f.is_dir ? "-" : formatSize(f.size)}</td>
                    <td className="p-2 text-right">
                      {!f.is_dir && <Button variant="ghost" size="sm" onClick={() => handleDownload(f.name)}><Download className="w-3.5 h-3.5" /></Button>}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(f.name)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- ADB Terminal ---
function ADBTerminalDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/terminal/${device.id}`);
    wsRef.current = ws;
    ws.onopen = () => { setConnected(true); setOutput(["Connected to ADB shell...\n"]); };
    ws.onmessage = (e) => { setOutput(prev => [...prev.slice(-500), e.data]); };
    ws.onclose = () => { setConnected(false); setOutput(prev => [...prev, "\n--- Disconnected ---\n"]); };
    ws.onerror = () => { setConnected(false); };
    return () => { ws.close(); };
  }, [open, device.id]);

  useEffect(() => { outputRef.current?.scrollTo(0, outputRef.current.scrollHeight); }, [output]);

  const sendCommand = () => {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(input + "\n");
    setInput("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" /> ADB Terminal - {device.name}
            <Badge variant={connected ? "default" : "destructive"} className="ml-2">{connected ? "Connected" : "Disconnected"}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div ref={outputRef} className="flex-1 bg-gray-900 text-green-400 font-mono text-xs p-3 rounded overflow-y-auto min-h-[300px] max-h-[60vh] whitespace-pre-wrap">
          {output.join("")}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendCommand()}
            placeholder="Type ADB command..."
            className="font-mono text-sm"
            disabled={!connected}
          />
          <Button onClick={sendCommand} disabled={!connected}>Send</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- App Manager ---
function AppManagerDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [apps, setApps] = useState<{ package: string; apk_path: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [installing, setInstalling] = useState(false);

  const loadApps = useCallback(async () => {
    setLoading(true);
    try { const res = await api.listApps(device.id); setApps(res.apps); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [device.id]);

  useEffect(() => { if (open) loadApps(); }, [open]);

  const handleInstallApk = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInstalling(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = (reader.result as string).split(",")[1];
      try { await api.installApk(device.id, b64, file.name); loadApps(); } catch (err) { alert("Install failed: " + (err as Error).message); }
      finally { setInstalling(false); }
    };
    reader.readAsDataURL(file);
  };

  const handleUninstall = async (pkg: string) => {
    if (!confirm(`Uninstall ${pkg}?`)) return;
    try { await api.uninstallApp(device.id, pkg); loadApps(); } catch (e) { console.error(e); }
  };

  const filtered = apps.filter(a => a.package.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> App Manager - {device.name}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
            <Input placeholder="Search packages..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <label className="cursor-pointer">
            <input type="file" accept=".apk" className="hidden" onChange={handleInstallApk} />
            <Button variant="default" asChild disabled={installing}><span>{installing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}Install APK</span></Button>
          </label>
        </div>
        <div className="flex-1 overflow-y-auto border rounded max-h-[50vh]">
          {loading ? (
            <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : (
            <div className="divide-y">
              {filtered.map((app) => (
                <div key={app.package} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="min-w-0">
                    <div className="text-sm font-mono truncate">{app.package}</div>
                    <div className="text-xs text-gray-400 truncate">{app.apk_path}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => api.forceStopApp(device.id, app.package)} title="Force Stop"><Square className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => handleUninstall(app.package)} className="text-red-500" title="Uninstall"><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="text-xs text-gray-500">{filtered.length} packages</div>
      </DialogContent>
    </Dialog>
  );
}

// --- Logcat Viewer ---
function LogcatDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  useEffect(() => {
    if (!open) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/logcat/${device.id}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = (e) => { if (!pausedRef.current) setLogs(prev => [...prev.slice(-1000), e.data]); };
    ws.onclose = () => setConnected(false);
    return () => { ws.close(); };
  }, [open, device.id]);

  useEffect(() => { if (!paused) outputRef.current?.scrollTo(0, outputRef.current.scrollHeight); }, [logs, paused]);

  const getLogColor = (line: string) => {
    if (line.includes(" E ") || line.includes(" E/")) return "text-red-400";
    if (line.includes(" W ") || line.includes(" W/")) return "text-yellow-400";
    if (line.includes(" I ") || line.includes(" I/")) return "text-green-400";
    if (line.includes(" D ") || line.includes(" D/")) return "text-blue-400";
    return "text-gray-400";
  };

  const filteredLogs = filter ? logs.filter(l => l.toLowerCase().includes(filter.toLowerCase())) : logs;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="w-5 h-5" /> Device Logs - {device.name}
            <Badge variant={connected ? "default" : "destructive"}>{connected ? "Live" : "Disconnected"}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input placeholder="Filter logs..." value={filter} onChange={(e) => setFilter(e.target.value)} className="flex-1 text-sm" />
          <Button variant={paused ? "default" : "outline"} size="sm" onClick={() => setPaused(!paused)}>{paused ? "Resume" : "Pause"}</Button>
          <Button variant="outline" size="sm" onClick={() => setLogs([])}>Clear</Button>
        </div>
        <div ref={outputRef} className="flex-1 bg-gray-900 font-mono text-xs p-3 rounded overflow-y-auto min-h-[300px] max-h-[60vh]">
          {filteredLogs.map((line, i) => (
            <div key={i} className={`whitespace-pre-wrap ${getLogColor(line)}`}>{line}</div>
          ))}
        </div>
        <div className="text-xs text-gray-500">{filteredLogs.length} lines</div>
      </DialogContent>
    </Dialog>
  );
}

// --- Clipboard Sync ---
function ClipboardDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [deviceClip, setDeviceClip] = useState("");
  const [loading, setLoading] = useState(false);

  const getFromDevice = async () => {
    setLoading(true);
    try { const res = await api.getClipboard(device.id); setDeviceClip(res.text); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  const sendToDevice = async () => {
    try { await api.setClipboard(device.id, text); alert("Sent to device clipboard"); } catch (e) { console.error(e); }
  };
  const copyToLocal = () => { navigator.clipboard.writeText(deviceClip); };

  useEffect(() => { if (open) getFromDevice(); }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Clipboard className="w-5 h-5" /> Clipboard Sync - {device.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Send to Device</Label>
            <div className="flex gap-2 mt-1">
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to send..." />
              <Button onClick={sendToDevice} size="sm"><Copy className="w-4 h-4 mr-1" /> Send</Button>
            </div>
          </div>
          <Separator />
          <div>
            <Label className="text-sm font-medium">Device Clipboard</Label>
            <div className="flex gap-2 mt-1">
              <Input value={deviceClip} readOnly className="bg-gray-50" />
              <Button variant="outline" size="sm" onClick={copyToLocal} title="Copy to PC"><Copy className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={getFromDevice}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Network Throttling ---
function NetworkThrottleDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [selected, setSelected] = useState("none");
  const [applying, setApplying] = useState(false);
  const profiles = [
    { id: "none", name: "No Throttling", desc: "Full speed connection", icon: <Wifi className="w-5 h-5 text-green-500" /> },
    { id: "4g", name: "4G LTE", desc: "30ms delay, 10Mbps", icon: <Signal className="w-5 h-5 text-blue-500" /> },
    { id: "3g", name: "3G", desc: "100ms delay, 1Mbps", icon: <Signal className="w-5 h-5 text-yellow-500" /> },
    { id: "2g", name: "2G / Edge", desc: "300ms delay, 50Kbps", icon: <Signal className="w-5 h-5 text-orange-500" /> },
    { id: "lossy", name: "Lossy Network", desc: "200ms delay, 10% loss", icon: <WifiOff className="w-5 h-5 text-red-500" /> },
  ];
  const apply = async () => {
    setApplying(true);
    try { await api.setNetworkThrottle(device.id, selected); } catch (e) { console.error(e); }
    finally { setApplying(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Signal className="w-5 h-5" /> Network Throttling - {device.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {profiles.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${selected === p.id ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-200 hover:border-gray-300"}`}>
              {p.icon}
              <div><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-gray-500">{p.desc}</div></div>
            </button>
          ))}
        </div>
        <Button onClick={apply} disabled={applying} className="w-full">{applying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}Apply</Button>
      </DialogContent>
    </Dialog>
  );
}

// --- Screen Recording ---
function ScreenRecordingControls({ device }: { device: DeviceInfo }) {
  const [recording, setRecording] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const startRec = async () => { try { await api.startRecording(device.id); setRecording(true); } catch (e) { console.error(e); } };
  const stopRec = async () => { try { await api.stopRecording(device.id); setRecording(false); } catch (e) { console.error(e); } };
  const downloadRec = async () => {
    setDownloading(true);
    try {
      const res = await api.downloadRecording(device.id);
      const link = document.createElement("a");
      link.href = `data:video/mp4;base64,${res.data}`;
      link.download = "recording.mp4";
      link.click();
    } catch (e) { alert("No recording available"); }
    finally { setDownloading(false); }
  };
  return (
    <div className="flex gap-1">
      {recording ? (
        <Button variant="destructive" size="sm" onClick={stopRec}><Square className="w-3.5 h-3.5 mr-1" /> Stop</Button>
      ) : (
        <Button variant="outline" size="sm" onClick={startRec}><Disc className="w-3.5 h-3.5 mr-1 text-red-500" /> Record</Button>
      )}
      <Button variant="ghost" size="sm" onClick={downloadRec} disabled={downloading}>
        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      </Button>
    </div>
  );
}

// --- Notification Center ---
function NotificationCenter() {
  const [notifications, setNotifications] = useState<{ id: number; type: string; title: string; message: string; device_id: string | null; is_read: number; created_at: string }[]>([]);
  const [open, setOpen] = useState(false);
  const loadNotifications = async () => {
    try { const res = await api.getNotifications(20); setNotifications(res); } catch (e) { console.error(e); }
  };
  useEffect(() => { loadNotifications(); const i = setInterval(loadNotifications, 30000); return () => clearInterval(i); }, []);
  const unreadCount = notifications.filter(n => !n.is_read).length;
  const markAllRead = async () => { try { await api.markAllNotificationsRead(); loadNotifications(); } catch (e) { console.error(e); } };
  const typeIcon = (t: string) => {
    if (t === "error") return <AlertTriangle className="w-4 h-4 text-red-500" />;
    if (t === "warning") return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <Bell className="w-4 h-4 text-blue-500" />;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="relative h-8 w-8 sm:h-9 sm:w-9 p-0">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{unreadCount}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="font-semibold text-sm">Notifications</span>
          {unreadCount > 0 && <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs h-6">Mark all read</Button>}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-64 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No notifications</div>
          ) : notifications.map(n => (
            <div key={n.id} className={`px-3 py-2 border-b last:border-0 ${!n.is_read ? "bg-blue-50 dark:bg-blue-900/10" : ""}`}>
              <div className="flex items-start gap-2">
                {typeIcon(n.type)}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-gray-500 truncate">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// --- Analytics Dashboard ---
function AnalyticsTab() {
  const [data, setData] = useState<{
    total_events: number; events_last_24h: number;
    by_type: { event_type: string; count: number }[];
    by_device: { device_id: string; count: number }[];
    timeline: { day: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try { const res = await api.getAnalyticsSummary(); setData(res); } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  if (!data) return <div className="p-8 text-center text-gray-500">Failed to load analytics</div>;

  const maxTimeline = Math.max(...data.timeline.map(t => t.count), 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{data.total_events}</div>
          <div className="text-sm text-gray-500">Total Events</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{data.events_last_24h}</div>
          <div className="text-sm text-gray-500">Last 24 Hours</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{data.by_device.length}</div>
          <div className="text-sm text-gray-500">Active Devices</div>
        </CardContent></Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> Events by Type</CardTitle></CardHeader>
          <CardContent>
            {data.by_type.length === 0 ? <p className="text-sm text-gray-500">No events yet</p> : (
              <div className="space-y-2">
                {data.by_type.map(t => (
                  <div key={t.event_type} className="flex items-center gap-2">
                    <span className="text-sm w-32 truncate">{t.event_type}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.max((t.count / Math.max(...data.by_type.map(x => x.count), 1)) * 100, 5)}%` }} />
                    </div>
                    <span className="text-sm font-medium w-10 text-right">{t.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> 7-Day Timeline</CardTitle></CardHeader>
          <CardContent>
            {data.timeline.length === 0 ? <p className="text-sm text-gray-500">No activity yet</p> : (
              <div className="flex items-end gap-1 h-32">
                {data.timeline.map(t => (
                  <div key={t.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max((t.count / maxTimeline) * 100, 4)}%` }} />
                    <span className="text-xs text-gray-400">{t.day.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// --- Device Templates ---
function TemplatesTab({ profiles, onLaunch }: { profiles: HardwareProfile[]; onLaunch: (t: Record<string, unknown>) => void }) {
  const [templates, setTemplates] = useState<{ id: number; name: string; description: string; profile_id: string; android_version: string; ram_mb: number; storage_gb: number; cpus: number; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [profileId, setProfileId] = useState("");
  const [ramMb, setRamMb] = useState(4096);
  const [storageGb, setStorageGb] = useState(64);
  const [cpus, setCpus] = useState(4);

  const load = async () => {
    try { const res = await api.getTemplates(); setTemplates(res); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name || !profileId) return;
    try {
      await api.createTemplate({ name, description: desc, profile_id: profileId, ram_mb: ramMb, storage_gb: storageGb, cpus });
      setShowCreate(false); setName(""); setDesc(""); load();
    } catch (e) { alert((e as Error).message); }
  };

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">Device Templates</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4 mr-1" /> New Template</Button>
      </div>
      {templates.length === 0 ? (
        <Card className="py-8"><CardContent className="text-center text-gray-500">
          <LayoutTemplate className="w-12 h-12 mx-auto text-gray-300 mb-2" />
          <p>No templates yet. Create one to quickly launch pre-configured devices.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => {
            const prof = profiles.find(p => p.id === t.profile_id);
            return (
              <Card key={t.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2"><LayoutTemplate className="w-4 h-4" />{t.name}</CardTitle>
                  {t.description && <CardDescription>{t.description}</CardDescription>}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-sm text-gray-500 space-y-1">
                    <div>Profile: {prof?.name || t.profile_id}</div>
                    <div>{t.ram_mb}MB RAM | {t.storage_gb}GB | {t.cpus} CPUs</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => onLaunch({ name: `${t.name}-device`, profile_id: t.profile_id, ram_mb: t.ram_mb, storage_gb: t.storage_gb, cpus: t.cpus, android_version: t.android_version || "14", os_type: "aosp", gpu_mode: "guest_swiftshader" })}>
                      <Play className="w-3.5 h-3.5 mr-1" /> Launch
                    </Button>
                    <Button variant="destructive" size="sm" onClick={async () => { await api.deleteTemplate(t.id); load(); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Device Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., QA Testing Setup" /></div>
            <div><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional description" /></div>
            <div><Label>Hardware Profile</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger><SelectValue placeholder="Select profile" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><Label>RAM (MB)</Label><Input type="number" value={ramMb} onChange={(e) => setRamMb(Number(e.target.value))} /></div>
              <div><Label>Storage (GB)</Label><Input type="number" value={storageGb} onChange={(e) => setStorageGb(Number(e.target.value))} /></div>
              <div><Label>CPUs</Label><Input type="number" value={cpus} onChange={(e) => setCpus(Number(e.target.value))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name || !profileId}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- API Keys Management ---
function ApiKeysTab() {
  const [keys, setKeys] = useState<{ id: number; name: string; key_prefix: string; permissions: string; is_active: number; created_at: string; username: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState("");

  const load = async () => {
    try { const res = await api.getApiKeys(); setKeys(res); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name) return;
    try {
      const res = await api.createApiKey(name, 1, ["read", "write"]);
      setNewKey(res.key);
      setName("");
      load();
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg flex items-center gap-2"><Key className="w-5 h-5" /> API Keys</h3>
        <Button size="sm" onClick={() => { setShowCreate(true); setNewKey(""); }}><Plus className="w-4 h-4 mr-1" /> Create Key</Button>
      </div>
      {newKey && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 space-y-2">
            <div className="text-sm font-medium text-green-800">New API Key Created - Save this now!</div>
            <code className="block bg-white p-2 rounded border text-xs break-all select-all">{newKey}</code>
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(newKey); }}><Copy className="w-3.5 h-3.5 mr-1" /> Copy</Button>
          </CardContent>
        </Card>
      )}
      <div className="border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="text-left p-3">Name</th><th className="text-left p-3">Key</th><th className="text-left p-3">User</th><th className="text-left p-3">Created</th><th className="p-3 w-16"></th></tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No API keys</td></tr>
            ) : keys.map(k => (
              <tr key={k.id} className="border-t">
                <td className="p-3 font-medium">{k.name}</td>
                <td className="p-3 font-mono text-xs">{k.key_prefix}</td>
                <td className="p-3">{k.username}</td>
                <td className="p-3 text-gray-500">{new Date(k.created_at).toLocaleDateString()}</td>
                <td className="p-3"><Button variant="ghost" size="sm" onClick={async () => { await api.deleteApiKey(k.id); load(); }} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create API Key</DialogTitle></DialogHeader>
          <div><Label>Key Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., CI/CD Pipeline" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Snapshots Manager ---
function SnapshotsDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [snapshots, setSnapshots] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [snapName, setSnapName] = useState("");

  const load = async () => {
    setLoading(true);
    try { const res = await api.getSnapshots(); setSnapshots(res.snapshots); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open) load(); }, [open]);

  const handleCreate = async () => {
    const name = snapName || `snap_${device.id}_${Date.now()}`;
    setCreating(true);
    try { await api.createSnapshot(device.id, name); setSnapName(""); load(); } catch (e) { alert((e as Error).message); }
    finally { setCreating(false); }
  };
  const handleDelete = async (name: string) => {
    if (!confirm(`Delete snapshot "${name}"?`)) return;
    try { await api.deleteSnapshot(name); load(); } catch (e) { console.error(e); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Save className="w-5 h-5" /> Snapshots - {device.name}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={snapName} onChange={(e) => setSnapName(e.target.value)} placeholder="Snapshot name (optional)" className="flex-1" />
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Create
          </Button>
        </div>
        <div className="border rounded max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : snapshots.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">No snapshots</div>
          ) : snapshots.map(s => (
            <div key={s.name} className="flex items-center justify-between p-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-gray-400" />
                <span className="text-sm">{s.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.name)} className="text-red-500"><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Multi-device Action Bar ---
// --- Device Health Monitor Dialog ---
function DeviceHealthDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [history, setHistory] = useState<{ cpu: number; mem: number; time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const h = await api.getDeviceHealth(device.id);
      setHealth(h);
      setHistory(prev => {
        const next = [...prev, { cpu: h.cpu_usage, mem: h.mem_used_mb, time: new Date().toLocaleTimeString() }];
        return next.slice(-20);
      });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [device.id]);

  useEffect(() => {
    if (!open) return;
    fetchHealth();
    const iv = setInterval(fetchHealth, 5000);
    return () => clearInterval(iv);
  }, [open, fetchHealth]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Activity className="w-5 h-5 text-green-500" /> Device Health — {device.name}</DialogTitle>
        </DialogHeader>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : health ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Card><CardContent className="pt-3 pb-2">
                <div className="flex items-center gap-1.5 mb-1"><Cpu className="w-3.5 h-3.5 text-blue-500" /><span className="text-xs font-medium">CPU</span></div>
                <div className="text-xl font-bold">{(health.cpu_usage as number).toFixed(1)}%</div>
                <Progress value={health.cpu_usage as number} className="mt-1 h-1.5" />
              </CardContent></Card>
              <Card><CardContent className="pt-3 pb-2">
                <div className="flex items-center gap-1.5 mb-1"><MemoryStick className="w-3.5 h-3.5 text-green-500" /><span className="text-xs font-medium">RAM</span></div>
                <div className="text-xl font-bold">{health.mem_used_mb as number}MB</div>
                <div className="text-xs text-gray-500">/ {health.mem_total_mb as number}MB</div>
                <Progress value={(health.mem_total_mb as number) > 0 ? ((health.mem_used_mb as number) / (health.mem_total_mb as number)) * 100 : 0} className="mt-1 h-1.5" />
              </CardContent></Card>
              <Card><CardContent className="pt-3 pb-2">
                <div className="flex items-center gap-1.5 mb-1"><Battery className="w-3.5 h-3.5 text-yellow-500" /><span className="text-xs font-medium">Battery</span></div>
                <div className="text-xl font-bold">{health.battery_level as number}%</div>
                <div className="text-xs text-gray-500">{health.battery_status as string}</div>
                <Progress value={Math.max(0, health.battery_level as number)} className="mt-1 h-1.5" />
              </CardContent></Card>
              <Card><CardContent className="pt-3 pb-2">
                <div className="flex items-center gap-1.5 mb-1"><Thermometer className="w-3.5 h-3.5 text-red-500" /><span className="text-xs font-medium">Temperature</span></div>
                <div className="text-xl font-bold">{(health.battery_temp as number).toFixed(1)}°C</div>
                <div className="text-xs text-gray-500">Device temp: {(health.temperature_c as number).toFixed(1)}°C</div>
              </CardContent></Card>
            </div>
            <Card><CardContent className="pt-3 pb-2">
              <div className="flex items-center gap-1.5 mb-1"><HardDrive className="w-3.5 h-3.5 text-orange-500" /><span className="text-xs font-medium">Disk</span></div>
              <div className="text-sm">{health.disk_used_mb as number}MB / {health.disk_total_mb as number}MB</div>
              <Progress value={(health.disk_total_mb as number) > 0 ? ((health.disk_used_mb as number) / (health.disk_total_mb as number)) * 100 : 0} className="mt-1 h-1.5" />
            </CardContent></Card>
            {history.length > 1 && (
              <Card><CardContent className="pt-3 pb-2">
                <div className="text-xs font-medium mb-2">CPU Usage Over Time</div>
                <div className="h-24 flex items-end gap-0.5">
                  {history.map((h, i) => (
                    <div key={i} className="flex-1 bg-blue-500 rounded-t-sm transition-all" style={{ height: `${Math.max(2, h.cpu)}%` }} title={`${h.cpu.toFixed(1)}% at ${h.time}`} />
                  ))}
                </div>
              </CardContent></Card>
            )}
            <div className="text-xs text-gray-500">Uptime: {health.uptime as string}</div>
          </div>
        ) : <p className="text-sm text-gray-500">Failed to load health data</p>}
      </DialogContent>
    </Dialog>
  );
}

// --- GPS Simulation Dialog ---
function GPSSimulatorDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [lat, setLat] = useState("40.7128");
  const [lng, setLng] = useState("-74.0060");
  const [presets, setPresets] = useState<{ name: string; latitude: number; longitude: number }[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) api.getGpsPresets().then(r => setPresets(r.presets)).catch(() => {});
  }, [open]);

  const handleSet = async () => {
    setLoading(true);
    setStatus("");
    try {
      await api.setGps(device.id, parseFloat(lat), parseFloat(lng));
      setStatus("GPS location set!");
    } catch (e) { setStatus((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Navigation className="w-5 h-5 text-blue-500" /> GPS Simulation — {device.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Latitude</Label>
              <Input value={lat} onChange={e => setLat(e.target.value)} placeholder="40.7128" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Longitude</Label>
              <Input value={lng} onChange={e => setLng(e.target.value)} placeholder="-74.0060" />
            </div>
          </div>
          <Button onClick={handleSet} disabled={loading} className="w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MapPin className="w-4 h-4 mr-1" />} Set Location
          </Button>
          {status && <p className={`text-xs ${status.includes("set") ? "text-green-600" : "text-red-500"}`}>{status}</p>}
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Quick Presets</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map(p => (
                <button key={p.name} onClick={() => { setLat(String(p.latitude)); setLng(String(p.longitude)); }}
                  className="text-xs text-left p-2 rounded border hover:bg-gray-50 transition">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-gray-400">{p.latitude}, {p.longitude}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- SMS/Call Simulation Dialog ---
function SMSCallDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [phone, setPhone] = useState("+15551234567");
  const [message, setMessage] = useState("Test message from Device Manager");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [callActive, setCallActive] = useState(false);

  const handleSendSms = async () => {
    setLoading(true); setStatus("");
    try {
      await api.sendSms(device.id, phone, message);
      setStatus("SMS sent!");
    } catch (e) { setStatus((e as Error).message); }
    finally { setLoading(false); }
  };

  const handleCall = async () => {
    setLoading(true); setStatus("");
    try {
      if (callActive) {
        await api.makeCall(device.id, phone, "end");
        setCallActive(false);
        setStatus("Call ended");
      } else {
        await api.makeCall(device.id, phone, "call");
        setCallActive(true);
        setStatus("Call initiated!");
      }
    } catch (e) { setStatus((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-green-500" /> SMS & Call Simulation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Phone Number</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+15551234567" />
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Send SMS</Label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              className="w-full text-sm border rounded-md p-2 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Type message..." />
            <Button onClick={handleSendSms} disabled={loading} className="w-full" variant="outline">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MessageSquare className="w-4 h-4 mr-1" />} Send SMS
            </Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Phone Call</Label>
            <Button onClick={handleCall} disabled={loading} className="w-full" variant={callActive ? "destructive" : "outline"}>
              {callActive ? <><PhoneOff className="w-4 h-4 mr-1" /> End Call</> : <><Phone className="w-4 h-4 mr-1" /> Make Call</>}
            </Button>
          </div>
          {status && <p className={`text-xs ${status.includes("!") ? "text-green-600" : "text-red-500"}`}>{status}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Locale Switcher Dialog ---
function LocaleSwitcherDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [locales, setLocales] = useState<{ code: string; name: string; flag: string }[]>([]);
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.getLocales().then(r => setLocales(r.locales)).catch(() => {});
    api.getDeviceLocale(device.id).then(r => setCurrent(r.locale)).catch(() => {});
  }, [open, device.id]);

  const handleSet = async (locale: string) => {
    setLoading(true); setStatus("");
    try {
      await api.setDeviceLocale(device.id, locale);
      setCurrent(locale);
      setStatus(`Locale set to ${locale}`);
    } catch (e) { setStatus((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Languages className="w-5 h-5 text-purple-500" /> Locale / Language — {device.name}</DialogTitle>
          <DialogDescription>Current: {current || "Loading..."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {locales.map(l => (
            <button key={l.code} onClick={() => handleSet(l.code)} disabled={loading}
              className={`text-left p-2.5 rounded-lg border text-sm transition ${current === l.code ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "hover:bg-gray-50"}`}>
              <div className="font-medium">{l.name}</div>
              <div className="text-xs text-gray-400">{l.code}</div>
            </button>
          ))}
        </div>
        {status && <p className="text-xs text-green-600 mt-2">{status}</p>}
      </DialogContent>
    </Dialog>
  );
}

// --- Device Pools & Tags Tab ---
function PoolsTagsTab({ devices }: { devices: DeviceInfo[] }) {
  const [pools, setPools] = useState<{ id: number; name: string; description: string; color: string; devices: string[] }[]>([]);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.getPools();
      setPools(r.pools);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await api.createPool(newName, newDesc, newColor);
      setNewName(""); setNewDesc("");
      await load();
    } catch (e) { alert((e as Error).message); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this pool?")) return;
    await api.deletePool(id);
    await load();
  };

  const handleAddDevice = async (poolId: number, deviceId: string) => {
    await api.addDeviceToPool(poolId, deviceId);
    await load();
  };

  const handleRemoveDevice = async (poolId: number, deviceId: string) => {
    await api.removeDeviceFromPool(poolId, deviceId);
    await load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Boxes className="w-5 h-5" /> Create Device Pool</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Pool name" value={newName} onChange={e => setNewName(e.target.value)} className="flex-1 min-w-[150px]" />
            <Input placeholder="Description" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="flex-1 min-w-[150px]" />
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="w-10 h-9 rounded border cursor-pointer" />
            <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> Create</Button>
          </div>
        </CardContent>
      </Card>
      {pools.length === 0 ? (
        <Card className="py-8"><CardContent className="text-center text-gray-500">No pools created yet</CardContent></Card>
      ) : pools.map(pool => (
        <Card key={pool.id}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pool.color }} />
                <CardTitle className="text-base">{pool.name}</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(pool.id)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
            </div>
            {pool.description && <CardDescription>{pool.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {pool.devices.map(did => {
                const d = devices.find(x => x.id === did);
                return (
                  <Badge key={did} variant="secondary" className="gap-1">
                    {d?.name || did}
                    <button onClick={() => handleRemoveDevice(pool.id, did)} className="ml-1 hover:text-red-500"><X className="w-3 h-3" /></button>
                  </Badge>
                );
              })}
            </div>
            <Select onValueChange={(v) => handleAddDevice(pool.id, v)}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Add device..." /></SelectTrigger>
              <SelectContent>
                {devices.filter(d => !pool.devices.includes(d.id)).map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Scheduling Tab ---
function SchedulingTab({ devices }: { devices: DeviceInfo[] }) {
  const { auth } = useAuth();
  const [schedules, setSchedules] = useState<{ id: number; device_id: string; title: string; start_time: string; end_time: string; status: string; username: string }[]>([]);
  const [title, setTitle] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await api.getSchedules(); setSchedules(r.schedules); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!title || !deviceId || !startTime || !endTime) return;
    try {
      await api.createSchedule(deviceId, auth.user?.id || 1, title, startTime, endTime);
      setTitle(""); setStartTime(""); setEndTime("");
      await load();
    } catch (e) { alert((e as Error).message); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="w-5 h-5" /> Reserve Device</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input placeholder="Reservation title" value={title} onChange={e => setTitle(e.target.value)} />
            <Select value={deviceId} onValueChange={setDeviceId}>
              <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
              <SelectContent>
                {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End</Label>
              <Input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
          <Button onClick={handleCreate} className="mt-3"><Plus className="w-4 h-4 mr-1" /> Reserve</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Scheduled Reservations</CardTitle></CardHeader>
        <CardContent>
          {schedules.length === 0 ? <p className="text-sm text-gray-500">No reservations</p> : (
            <div className="space-y-2">
              {schedules.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="font-medium text-sm">{s.title}</div>
                    <div className="text-xs text-gray-500">Device: {s.device_id} | By: {s.username || "N/A"}</div>
                    <div className="text-xs text-gray-400">{new Date(s.start_time).toLocaleString()} → {new Date(s.end_time).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.status === "scheduled" ? "default" : "secondary"}>{s.status}</Badge>
                    <Button variant="ghost" size="sm" onClick={async () => { await api.deleteSchedule(s.id); await load(); }}><Trash2 className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Cost Tracking Tab ---
function CostTrackingTab() {
  const [usage, setUsage] = useState<{ sessions: { id: number; device_id: string; started_at: string; ended_at: string | null; duration_seconds: number; cost_cents: number }[]; total_cost_cents: number; total_hours: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getUsage().then(r => { setUsage(r); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  if (!usage) return <p className="text-sm text-gray-500">Failed to load usage data</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><DollarSign className="w-4 h-4 text-green-500" /><span className="text-sm font-medium">Total Cost</span></div>
          <div className="text-2xl font-bold">${(usage.total_cost_cents / 100).toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><Clock className="w-4 h-4 text-blue-500" /><span className="text-sm font-medium">Total Hours</span></div>
          <div className="text-2xl font-bold">{usage.total_hours}h</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4 text-purple-500" /><span className="text-sm font-medium">Sessions</span></div>
          <div className="text-2xl font-bold">{usage.sessions.length}</div>
        </CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Usage Sessions</CardTitle></CardHeader>
        <CardContent>
          {usage.sessions.length === 0 ? <p className="text-sm text-gray-500">No usage sessions recorded</p> : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {usage.sessions.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded border text-sm">
                  <div>
                    <span className="font-medium">{s.device_id}</span>
                    <div className="text-xs text-gray-400">{new Date(s.started_at).toLocaleString()}{s.ended_at ? ` → ${new Date(s.ended_at).toLocaleString()}` : " (active)"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">${(s.cost_cents / 100).toFixed(2)}</div>
                    <div className="text-xs text-gray-400">{Math.round(s.duration_seconds / 60)}min</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Webhooks Tab ---
function WebhooksTab() {
  const [webhooks, setWebhooks] = useState<{ id: number; name: string; url: string; events: string; is_active: number; created_at: string }[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await api.getWebhooks(); setWebhooks(r.webhooks); } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name || !url) return;
    await api.createWebhook(name, url, ["device.created", "device.deleted"]);
    setName(""); setUrl("");
    await load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Webhook className="w-5 h-5" /> Add Webhook</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Webhook name" value={name} onChange={e => setName(e.target.value)} className="flex-1 min-w-[150px]" />
            <Input placeholder="https://your-ci.example.com/webhook" value={url} onChange={e => setUrl(e.target.value)} className="flex-1 min-w-[200px]" />
            <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-1" /> Add</Button>
          </div>
        </CardContent>
      </Card>
      {webhooks.length === 0 ? <Card className="py-8"><CardContent className="text-center text-gray-500">No webhooks configured</CardContent></Card> : (
        <div className="space-y-2">
          {webhooks.map(w => (
            <Card key={w.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${w.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                      <span className="font-medium text-sm">{w.name}</span>
                    </div>
                    <div className="text-xs text-gray-500 ml-4 mt-0.5">{w.url}</div>
                    <div className="text-xs text-gray-400 ml-4">Events: {w.events}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={async () => { await api.toggleWebhook(w.id); await load(); }}>
                      <Switch checked={!!w.is_active} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={async () => { await api.deleteWebhook(w.id); await load(); }}>
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Remote Debug Dialog ---
function RemoteDebugDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [info, setInfo] = useState<{ adb_connect: string; chrome_inspect: string; adb_forward: string; webrtc_url: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      api.getDebugInfo(device.id).then(r => { setInfo(r); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [open, device.id]);

  const copyToClip = (text: string) => { navigator.clipboard.writeText(text).catch(() => {}); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bug className="w-5 h-5 text-orange-500" /> Remote Debugging — {device.name}</DialogTitle>
        </DialogHeader>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div> : info ? (
          <div className="space-y-3">
            {[
              { label: "ADB Connect", value: info.adb_connect, icon: Terminal },
              { label: "Chrome Inspect", value: info.chrome_inspect, icon: Globe },
              { label: "ADB Forward", value: info.adb_forward, icon: GitBranch },
              { label: "WebRTC URL", value: info.webrtc_url, icon: Monitor },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-lg border">
                <div className="flex items-center gap-1.5 mb-1">
                  <item.icon className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-medium text-gray-500">{item.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 mr-2 overflow-x-auto">{item.value}</code>
                  <Button variant="ghost" size="sm" onClick={() => copyToClip(item.value)} className="h-7 px-2"><Copy className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">Failed to load debug info</p>}
      </DialogContent>
    </Dialog>
  );
}

// --- Automated Testing Dialog ---
function AutoTestDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [packageName, setPackageName] = useState("");
  const [eventCount, setEventCount] = useState(500);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ success: boolean; output: string } | null>(null);

  const handleRun = async () => {
    if (!packageName) return;
    setRunning(true); setResult(null);
    try {
      const r = await api.runMonkeyTest(device.id, packageName, eventCount);
      setResult(r);
    } catch (e) { setResult({ success: false, output: (e as Error).message }); }
    finally { setRunning(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><TestTube className="w-5 h-5 text-purple-500" /> Automated Testing — {device.name}</DialogTitle>
          <DialogDescription>Run Android Monkey stress test on an app</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Package Name</Label>
            <Input value={packageName} onChange={e => setPackageName(e.target.value)} placeholder="com.example.app" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Random Events</Label>
              <span className="text-xs font-medium">{eventCount}</span>
            </div>
            <Slider value={[eventCount]} onValueChange={([v]) => setEventCount(v)} min={100} max={5000} step={100} />
          </div>
          <Button onClick={handleRun} disabled={running || !packageName} className="w-full">
            {running ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Running Test...</> : <><Play className="w-4 h-4 mr-1" /> Run Monkey Test</>}
          </Button>
          {result && (
            <div className={`p-3 rounded-lg border ${result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className={`text-sm font-medium mb-1 ${result.success ? "text-green-700" : "text-red-700"}`}>
                {result.success ? "Test Passed!" : "Test Failed / Crash Detected"}
              </div>
              <pre className="text-xs overflow-x-auto max-h-40 whitespace-pre-wrap text-gray-600">{result.output}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Screenshot Comparison Dialog ---
function ScreenshotCompareDialog({ devices, open, onClose }: { devices: DeviceInfo[]; open: boolean; onClose: () => void }) {
  const [deviceA, setDeviceA] = useState("");
  const [deviceB, setDeviceB] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ screenshot_a: string | null; screenshot_b: string | null } | null>(null);

  const handleCompare = async () => {
    if (!deviceA || !deviceB) return;
    setLoading(true); setResult(null);
    try {
      const r = await api.compareScreenshots(deviceA, deviceB);
      setResult(r);
    } catch (e) { alert((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> Screenshot Comparison</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select value={deviceA} onValueChange={setDeviceA}>
              <SelectTrigger><SelectValue placeholder="Device A" /></SelectTrigger>
              <SelectContent>{devices.filter(d => d.status === "running").map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={deviceB} onValueChange={setDeviceB}>
              <SelectTrigger><SelectValue placeholder="Device B" /></SelectTrigger>
              <SelectContent>{devices.filter(d => d.status === "running" && d.id !== deviceA).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleCompare} disabled={loading || !deviceA || !deviceB} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Capturing...</> : <><Camera className="w-4 h-4 mr-1" /> Compare Screenshots</>}
          </Button>
          {result && (
            <div className="grid grid-cols-2 gap-3">
              {result.screenshot_a && <div className="space-y-1"><Label className="text-xs">Device A</Label><img src={`data:image/png;base64,${result.screenshot_a}`} alt="Device A" className="w-full rounded border" /></div>}
              {result.screenshot_b && <div className="space-y-1"><Label className="text-xs">Device B</Label><img src={`data:image/png;base64,${result.screenshot_b}`} alt="Device B" className="w-full rounded border" /></div>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- AI Test Generator Dialog ---
function AITestGeneratorDialog({ device, open, onClose }: { device: DeviceInfo; open: boolean; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    if (!prompt) return;
    setLoading(true);
    // Simulate AI generation (no external API key needed)
    setTimeout(() => {
      const steps = [
        `# Auto-Generated Test Plan for "${prompt}"`,
        `## Device: ${device.name} (Android ${device.android_version})`,
        ``,
        `### Test Steps:`,
        `1. Launch the application`,
        `2. Wait for main screen to load (2-3 seconds)`,
        `3. ${prompt.includes("login") ? "Enter credentials in login form" : "Navigate to the primary feature screen"}`,
        `4. Verify UI elements are displayed correctly`,
        `5. Perform the described action: "${prompt}"`,
        `6. Capture screenshot for visual verification`,
        `7. Check logcat for crashes or ANR events`,
        `8. Verify no memory leaks via dumpsys meminfo`,
        ``,
        `### ADB Commands:`,
        `\`\`\`bash`,
        `# Launch app`,
        `adb shell am start -n com.example.app/.MainActivity`,
        `# Wait for load`,
        `sleep 3`,
        `# Take screenshot`,
        `adb shell screencap -p /sdcard/test_screenshot.png`,
        `# Check for crashes`,
        `adb logcat -d | grep -i "crash\\|fatal\\|anr"`,
        `# Memory check`,
        `adb shell dumpsys meminfo com.example.app`,
        `\`\`\``,
        ``,
        `### Expected Results:`,
        `- No crashes detected in logcat`,
        `- UI elements render correctly`,
        `- Memory usage within acceptable limits`,
        `- Action completes without errors`,
      ];
      setResult(steps.join("\n"));
      setLoading(false);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-pink-500" /> AI Test Generator</DialogTitle>
          <DialogDescription>Describe what to test in plain English</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
            className="w-full text-sm border rounded-md p-2 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., Test the login flow with invalid credentials and verify error message appears" />
          <Button onClick={handleGenerate} disabled={loading || !prompt} className="w-full">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Generating...</> : <><Brain className="w-4 h-4 mr-1" /> Generate Test Plan</>}
          </Button>
          {result && (
            <div className="p-3 rounded-lg border bg-gray-50 max-h-80 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap font-mono">{result}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Voice Control Button ---
function VoiceControlButton({ onCommand }: { onCommand: (cmd: string) => void }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<unknown>(null);

  const toggle = () => {
    if (listening) {
      (recognitionRef.current as { stop: () => void })?.stop?.();
      setListening(false);
      return;
    }
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported in this browser"); return; }
    const recognition = new (SR as { new(): { continuous: boolean; interimResults: boolean; onresult: (e: { results: { transcript: string }[][] }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void } })();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: { results: { transcript: string }[][] }) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      onCommand(text);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant={listening ? "destructive" : "outline"} size="sm" onClick={toggle} className="h-8 w-8 sm:h-9 sm:w-9 p-0" title="Voice Control">
        {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>
      {transcript && <span className="text-xs text-gray-500 max-w-[200px] truncate">"{transcript}"</span>}
    </div>
  );
}

// --- Device Tag Badges on Card ---
function DeviceTagBadges({ deviceId }: { deviceId: string }) {
  const [tags, setTags] = useState<{ tag: string; color: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    api.getDeviceTags(deviceId).then(r => setTags(r.tags)).catch(() => {});
  }, [deviceId]);

  const handleAdd = async () => {
    if (!newTag.trim()) return;
    await api.addDeviceTag(deviceId, newTag.trim());
    setNewTag(""); setAdding(false);
    const r = await api.getDeviceTags(deviceId);
    setTags(r.tags);
  };

  const handleRemove = async (tag: string) => {
    await api.removeDeviceTag(deviceId, tag);
    const r = await api.getDeviceTags(deviceId);
    setTags(r.tags);
  };

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {tags.map(t => (
        <Badge key={t.tag} variant="outline" className="text-xs px-1.5 py-0 gap-0.5" style={{ borderColor: t.color, color: t.color }}>
          <Tag className="w-2.5 h-2.5" />{t.tag}
          <button onClick={() => handleRemove(t.tag)} className="ml-0.5 hover:opacity-70"><X className="w-2.5 h-2.5" /></button>
        </Badge>
      ))}
      {adding ? (
        <div className="flex items-center gap-1">
          <Input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()}
            className="h-5 text-xs w-20 px-1" placeholder="tag" autoFocus />
          <button onClick={handleAdd} className="text-green-500 hover:text-green-700"><Plus className="w-3 h-3" /></button>
          <button onClick={() => setAdding(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3 h-3" /></button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="text-gray-400 hover:text-blue-500" title="Add tag"><Hash className="w-3 h-3" /></button>
      )}
    </div>
  );
}

function MultiDeviceActionBar({ selectedIds, onClearSelection, onRefresh }: {
  selectedIds: Set<string>; onClearSelection: () => void; onRefresh: () => void;
}) {
  const [executing, setExecuting] = useState(false);
  const runAction = async (action: string) => {
    setExecuting(true);
    try {
      const res = await api.bulkAction(Array.from(selectedIds), action);
      const failed = Object.entries(res.results).filter(([, v]) => !v.success);
      if (failed.length > 0) alert(`${failed.length} device(s) failed: ${failed.map(([k, v]) => `${k}: ${v.message}`).join(", ")}`);
      onRefresh();
    } catch (e) { alert((e as Error).message); }
    finally { setExecuting(false); }
  };
  if (selectedIds.size === 0) return null;
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-900 border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 z-50">
      <span className="text-sm font-medium">{selectedIds.size} device(s) selected</span>
      <Separator orientation="vertical" className="h-6" />
      <Button variant="outline" size="sm" onClick={() => runAction("reboot")} disabled={executing}>
        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reboot All
      </Button>
      <Button variant="outline" size="sm" onClick={() => runAction("screenshot")} disabled={executing}>
        <Camera className="w-3.5 h-3.5 mr-1" /> Screenshot All
      </Button>
      <Button variant="ghost" size="sm" onClick={onClearSelection}><X className="w-3.5 h-3.5" /></Button>
    </div>
  );
}

function DeviceCard({
  device,
  onDelete,
  onEdit,
  onViewScreen,
  deleting,
  isAdmin,
  selected,
  onToggleSelect,
  onOpenFileManager,
  onOpenTerminal,
  onOpenApps,
  onOpenLogcat,
  onOpenClipboard,
  onOpenNetwork,
  onOpenSnapshots,
  onOpenHealth,
  onOpenGps,
  onOpenSmsCall,
  onOpenLocale,
  onOpenDebug,
  onOpenAutoTest,
  onOpenAiTest,
}: {
  device: DeviceInfo;
  onDelete: (id: string) => void;
  onEdit: (device: DeviceInfo) => void;
  onViewScreen: (device: DeviceInfo) => void;
  deleting: boolean;
  isAdmin: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpenFileManager: () => void;
  onOpenTerminal: () => void;
  onOpenApps: () => void;
  onOpenLogcat: () => void;
  onOpenClipboard: () => void;
  onOpenNetwork: () => void;
  onOpenSnapshots: () => void;
  onOpenHealth: () => void;
  onOpenGps: () => void;
  onOpenSmsCall: () => void;
  onOpenLocale: () => void;
  onOpenDebug: () => void;
  onOpenAutoTest: () => void;
  onOpenAiTest: () => void;
}) {
  return (
    <Card className={`hover:shadow-md transition-shadow ${selected ? "ring-2 ring-blue-500" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onToggleSelect} className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${selected ? "bg-blue-500 border-blue-500 text-white" : "border-gray-300 hover:border-blue-400"}`}>
              {selected && <CheckSquare className="w-3.5 h-3.5" />}
            </button>
            <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-base">{device.name}</CardTitle>
              <CardDescription className="text-xs">{device.profile_name}</CardDescription>
            </div>
          </div>
          <StatusBadge status={device.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500"><CircleDot className="w-3.5 h-3.5" /><span>Android {device.android_version}</span></div>
          <div className="flex items-center gap-1.5 text-gray-500"><Cpu className="w-3.5 h-3.5" /><span>{device.cpus} CPUs</span></div>
          <div className="flex items-center gap-1.5 text-gray-500"><MemoryStick className="w-3.5 h-3.5" /><span>{device.ram_mb >= 1024 ? `${(device.ram_mb / 1024).toFixed(0)}GB` : `${device.ram_mb}MB`} RAM</span></div>
          <div className="flex items-center gap-1.5 text-gray-500"><HardDrive className="w-3.5 h-3.5" /><span>{device.storage_gb}GB Storage</span></div>
        </div>
        {/* Tags */}
        <DeviceTagBadges deviceId={device.id} />
        <Separator />
        <div className="text-xs space-y-1 text-gray-500">
          <div>Resolution: {device.x_res}x{device.y_res} @ {device.dpi}dpi</div>
          <div>ADB: {device.ip}:{device.adb_port}</div>
          {device.assigned_users.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-gray-400">Assigned:</span>
              {device.assigned_users.map((u) => (<Badge key={u} variant="outline" className="text-xs px-1.5 py-0">{u}</Badge>))}
            </div>
          )}
        </div>
        {/* Primary actions */}
        <div className="flex gap-2 pt-1">
          {device.status === "running" && (
            <Button variant="outline" size="sm" className="flex-1" onClick={() => onViewScreen(device)}>
              <Eye className="w-3.5 h-3.5 mr-1" /> View Screen
            </Button>
          )}
          {isAdmin && <Button variant="outline" size="sm" onClick={() => onEdit(device)}><Edit className="w-3.5 h-3.5" /></Button>}
          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={() => onDelete(device.id)} disabled={deleting}>
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </Button>
          )}
        </div>
        {/* Advanced tools - Row 1: Core Tools */}
        {device.status === "running" && (
          <div className="flex flex-wrap gap-1 pt-1">
            <Button variant="ghost" size="sm" onClick={onOpenFileManager} title="File Manager" className="h-7 px-2"><FolderOpen className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenTerminal} title="ADB Terminal" className="h-7 px-2"><Terminal className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenApps} title="App Manager" className="h-7 px-2"><Package className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenLogcat} title="Device Logs" className="h-7 px-2"><ScrollText className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenClipboard} title="Clipboard Sync" className="h-7 px-2"><Clipboard className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenNetwork} title="Network Throttle" className="h-7 px-2"><Signal className="w-3.5 h-3.5" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenSnapshots} title="Snapshots" className="h-7 px-2"><Save className="w-3.5 h-3.5" /></Button>
            <ScreenRecordingControls device={device} />
          </div>
        )}
        {/* Advanced tools - Row 2: New Features */}
        {device.status === "running" && (
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={onOpenHealth} title="Device Health" className="h-7 px-2"><Activity className="w-3.5 h-3.5 text-green-500" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenGps} title="GPS Simulation" className="h-7 px-2"><Navigation className="w-3.5 h-3.5 text-blue-500" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenSmsCall} title="SMS/Call Sim" className="h-7 px-2"><MessageSquare className="w-3.5 h-3.5 text-green-600" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenLocale} title="Locale/Language" className="h-7 px-2"><Languages className="w-3.5 h-3.5 text-purple-500" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenDebug} title="Remote Debug" className="h-7 px-2"><Bug className="w-3.5 h-3.5 text-orange-500" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenAutoTest} title="Monkey Test" className="h-7 px-2"><TestTube className="w-3.5 h-3.5 text-purple-600" /></Button>
            <Button variant="ghost" size="sm" onClick={onOpenAiTest} title="AI Test Generator" className="h-7 px-2"><Brain className="w-3.5 h-3.5 text-pink-500" /></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProfileSelector({
  title,
  profiles,
  profileId,
  setProfileId,
}: {
  title: string;
  profiles: HardwareProfile[];
  profileId: string;
  setProfileId: (id: string) => void;
}) {
  if (profiles.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {profiles.map((p) => (
          <button
            key={p.id}
            className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
              profileId === p.id
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => setProfileId(p.id)}
          >
            <ProfileIcon category={p.category} />
            <div className="min-w-0">
              <div className="font-medium text-sm truncate">{p.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {p.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CreateDeviceDialog({
  profiles,
  versions,
  osTypes,
  onCreated,
}: {
  profiles: HardwareProfile[];
  versions: AndroidVersion[];
  osTypes: OSType[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [profileId, setProfileId] = useState("");
  const [androidVersion, setAndroidVersion] = useState("14");
  const [osType, setOsType] = useState("aosp");
  const [ramMb, setRamMb] = useState(4096);
  const [storageGb, setStorageGb] = useState(64);
  const [cpus, setCpus] = useState(4);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selectedProfile = profiles.find((p) => p.id === profileId);

  useEffect(() => {
    if (selectedProfile) {
      setRamMb(selectedProfile.default_ram_mb);
      setStorageGb(selectedProfile.default_storage_gb);
      setCpus(selectedProfile.default_cpus);
    }
  }, [selectedProfile]);

  const handleCreate = async () => {
    if (!name.trim() || !profileId) return;
    setCreating(true);
    setError("");
    try {
      await api.createDevice({
        name: name.trim(),
        profile_id: profileId,
        android_version: androidVersion,
        os_type: osType,
        ram_mb: ramMb,
        storage_gb: storageGb,
        cpus: cpus,
        gpu_mode: "guest_swiftshader",
      });
      setOpen(false);
      setName("");
      setProfileId("");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create device");
    } finally {
      setCreating(false);
    }
  };

  const flagshipProfiles = profiles.filter((p) => p.category === "flagship");
  const midRangeProfiles = profiles.filter((p) => p.category === "mid-range");
  const tabletProfiles = profiles.filter((p) => p.category === "tablet");
  const customProfiles = profiles.filter((p) => p.is_custom);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 sm:gap-2 sm:h-10 sm:px-4">
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Create</span> Device
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 shrink-0">
          <DialogTitle className="text-lg sm:text-xl">Create New Device</DialogTitle>
          <DialogDescription>
            Configure and launch a new Cuttlefish Android virtual device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 space-y-4 sm:space-y-6 py-3 sm:py-4">
          <div className="space-y-2">
            <Label htmlFor="device-name">Device Name</Label>
            <Input
              id="device-name"
              placeholder="My Test Device"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label>Android Version</Label>
              <Select value={androidVersion} onValueChange={setAndroidVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem
                      key={v.version}
                      value={v.version}
                      disabled={!v.available}
                    >
                      Android {v.version} (API {v.api_level})
                      {!v.available ? " - Coming Soon" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Operating System</Label>
              <Select value={osType} onValueChange={setOsType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select OS" />
                </SelectTrigger>
                <SelectContent>
                  {osTypes.map((os) => (
                    <SelectItem
                      key={os.id}
                      value={os.id}
                      disabled={!os.available}
                    >
                      {os.name}
                      {!os.available ? " - Coming Soon" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Hardware Profile</Label>
            <div className="space-y-4">
              <ProfileSelector
                title="Flagship"
                profiles={flagshipProfiles}
                profileId={profileId}
                setProfileId={setProfileId}
              />
              <ProfileSelector
                title="Mid-Range"
                profiles={midRangeProfiles}
                profileId={profileId}
                setProfileId={setProfileId}
              />
              <ProfileSelector
                title="Tablets"
                profiles={tabletProfiles}
                profileId={profileId}
                setProfileId={setProfileId}
              />
              {customProfiles.length > 0 && (
                <ProfileSelector
                  title="Custom"
                  profiles={customProfiles}
                  profileId={profileId}
                  setProfileId={setProfileId}
                />
              )}
            </div>
          </div>

          {selectedProfile && (
            <div className="space-y-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="text-sm font-medium">Resource Configuration</div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">RAM</Label>
                    <span className="text-sm font-medium">
                      {ramMb >= 1024
                        ? `${(ramMb / 1024).toFixed(0)} GB`
                        : `${ramMb} MB`}
                    </span>
                  </div>
                  <Slider
                    value={[ramMb]}
                    onValueChange={([v]) => setRamMb(v)}
                    min={1024}
                    max={32768}
                    step={1024}
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>1 GB</span>
                    <span>32 GB</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Storage</Label>
                    <span className="text-sm font-medium">{storageGb} GB</span>
                  </div>
                  <Slider
                    value={[storageGb]}
                    onValueChange={([v]) => setStorageGb(v)}
                    min={8}
                    max={512}
                    step={8}
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>8 GB</span>
                    <span>512 GB</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">CPU Cores</Label>
                    <span className="text-sm font-medium">{cpus} Cores</span>
                  </div>
                  <Slider
                    value={[cpus]}
                    onValueChange={([v]) => setCpus(v)}
                    min={1}
                    max={16}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>1</span>
                    <span>16</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1 pt-2">
                <div>
                  Display: {selectedProfile.x_res}x{selectedProfile.y_res} @{" "}
                  {selectedProfile.dpi}dpi
                </div>
                <div>GPU: SwiftShader (Software rendering)</div>
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-200 shrink-0 flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || !profileId || creating}
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" /> Launch Device
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfilesTab({
  profiles,
  onRefresh,
}: {
  profiles: HardwareProfile[];
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((p) => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <ProfileIcon category={p.category} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <CardDescription className="text-xs">
                      {p.brand} - {p.category}
                    </CardDescription>
                  </div>
                </div>
                {p.is_custom && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await api.deleteProfile(p.id);
                        onRefresh();
                      } catch {
                        // ignore
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">{p.description}</p>
              <Separator />
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <div>
                  Display: {p.x_res}x{p.y_res}
                </div>
                <div>DPI: {p.dpi}</div>
                <div>
                  RAM:{" "}
                  {p.default_ram_mb >= 1024
                    ? `${(p.default_ram_mb / 1024).toFixed(0)}GB`
                    : `${p.default_ram_mb}MB`}
                </div>
                <div>Storage: {p.default_storage_gb}GB</div>
                <div>CPUs: {p.default_cpus}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const { auth, logout } = useAuth();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [profiles, setProfiles] = useState<HardwareProfile[]>([]);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [versions, setVersions] = useState<AndroidVersion[]>([]);
  const [osTypes, setOsTypes] = useState<OSType[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingDevice, setDeletingDevice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [screenDevice, setScreenDevice] = useState<DeviceInfo | null>(null);
  const [editDevice, setEditDevice] = useState<DeviceInfo | null>(null);
  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletePasscodeInput, setDeletePasscodeInput] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [passcodeRequired, setPasscodeRequired] = useState(false);
  // Advanced feature dialogs
  const [fileManagerDevice, setFileManagerDevice] = useState<DeviceInfo | null>(null);
  const [terminalDevice, setTerminalDevice] = useState<DeviceInfo | null>(null);
  const [appManagerDevice, setAppManagerDevice] = useState<DeviceInfo | null>(null);
  const [logcatDevice, setLogcatDevice] = useState<DeviceInfo | null>(null);
  const [clipboardDevice, setClipboardDevice] = useState<DeviceInfo | null>(null);
  const [networkDevice, setNetworkDevice] = useState<DeviceInfo | null>(null);
  const [snapshotsDevice, setSnapshotsDevice] = useState<DeviceInfo | null>(null);
  // New advanced feature dialogs
  const [healthDevice, setHealthDevice] = useState<DeviceInfo | null>(null);
  const [gpsDevice, setGpsDevice] = useState<DeviceInfo | null>(null);
  const [smsCallDevice, setSmsCallDevice] = useState<DeviceInfo | null>(null);
  const [localeDevice, setLocaleDevice] = useState<DeviceInfo | null>(null);
  const [debugDevice, setDebugDevice] = useState<DeviceInfo | null>(null);
  const [autoTestDevice, setAutoTestDevice] = useState<DeviceInfo | null>(null);
  const [aiTestDevice, setAiTestDevice] = useState<DeviceInfo | null>(null);
  const [showScreenshotCompare, setShowScreenshotCompare] = useState(false);
  // Multi-device selection
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  const isAdmin = auth.user?.role === "admin";

  const toggleDeviceSelect = (id: string) => {
    setSelectedDevices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadData = useCallback(async () => {
    try {
      const [devs, profs, status, vers, ost] = await Promise.all([
        api.getDevices(),
        api.getProfiles(),
        api.getServerStatus(),
        api.getAndroidVersions(),
        api.getOsTypes(),
      ]);
      setDevices(devs);
      setProfiles(profs);
      setServerStatus(status);
      setVersions(vers);
      setOsTypes(ost);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshData = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleDeleteRequest = async (deviceId: string) => {
    try {
      const { required } = await api.isDeletePasscodeRequired();
      setPasscodeRequired(required);
    } catch {
      setPasscodeRequired(false);
    }
    setDeleteConfirmId(deviceId);
    setDeletePasscodeInput("");
    setDeleteError("");
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeletingDevice(deleteConfirmId);
    setDeleteError("");
    try {
      if (passcodeRequired) {
        await api.deleteDeviceWithPasscode(deleteConfirmId, deletePasscodeInput);
      } else {
        await api.deleteDevice(deleteConfirmId);
      }
      setDeleteConfirmId(null);
      await loadData();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete device");
    } finally {
      setDeletingDevice(null);
    }
  };

  const handleTemplateLaunch = async (tpl: Record<string, unknown>) => {
    try {
      await api.createDevice(tpl as any);
      await loadData();
    } catch (e) { alert((e as Error).message); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-500">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  const runningCount = devices.filter((d) => d.status === "running").length;
  const totalCount = devices.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-40">
        <div className="container mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 rounded-lg bg-blue-600 text-white shrink-0">
                <Server className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">Manager</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Android Virtual Device Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <div className="text-right hidden lg:block">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{runningCount} of {totalCount} devices running</div>
                <div className="text-xs text-gray-400">Auto-refreshes every 15s</div>
              </div>
              <VoiceControlButton onCommand={(cmd) => {
                const lower = cmd.toLowerCase();
                if (lower.includes("create") || lower.includes("new device")) {
                  alert(`Voice command: "${cmd}" — Use the Create Device dialog to set up a new device.`);
                } else if (lower.includes("delete") || lower.includes("remove")) {
                  alert(`Voice command: "${cmd}" — Select a device and click the delete button.`);
                } else if (lower.includes("screenshot") || lower.includes("compare")) {
                  setShowScreenshotCompare(true);
                } else {
                  alert(`Voice command received: "${cmd}"`);
                }
              }} />
              <NotificationCenter />
              <Button variant="outline" size="sm" onClick={toggleDark} className="h-8 w-8 sm:h-9 sm:w-9 p-0" title="Toggle dark mode">
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button variant="outline" size="sm" onClick={refreshData} disabled={refreshing} className="h-8 w-8 sm:h-9 sm:w-9 p-0">
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              {isAdmin && (
                <div className="hidden sm:block">
                  <CreateDeviceDialog profiles={profiles} versions={versions} osTypes={osTypes} onCreated={loadData} />
                </div>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3">
                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                      {auth.user?.username?.[0]?.toUpperCase() || "U"}
                    </div>
                    <span className="hidden md:inline text-sm">{auth.user?.username}</span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {auth.user?.username}
                    <div className="text-xs font-normal text-gray-500">{auth.user?.role === "admin" ? "Administrator" : "User"}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <ServerStatusPanel status={serverStatus} />

        <Tabs defaultValue="devices">
          <TabsList className="flex-wrap">
            <TabsTrigger value="devices" className="gap-1.5">
              <Smartphone className="w-4 h-4" /> <span className="hidden sm:inline">Devices</span> ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5">
              <LayoutTemplate className="w-4 h-4" /> <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="w-4 h-4" /> <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="profiles" className="gap-1.5">
              <Zap className="w-4 h-4" /> <span className="hidden sm:inline">Profiles</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="gap-1.5">
                <Shield className="w-4 h-4" /> <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="apikeys" className="gap-1.5">
                <Key className="w-4 h-4" /> <span className="hidden sm:inline">API Keys</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="pools" className="gap-1.5">
              <Boxes className="w-4 h-4" /> <span className="hidden sm:inline">Pools</span>
            </TabsTrigger>
            <TabsTrigger value="scheduling" className="gap-1.5">
              <Calendar className="w-4 h-4" /> <span className="hidden sm:inline">Scheduling</span>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5">
              <DollarSign className="w-4 h-4" /> <span className="hidden sm:inline">Billing</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="webhooks" className="gap-1.5">
                <Webhook className="w-4 h-4" /> <span className="hidden sm:inline">Webhooks</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="devices" className="mt-4">
            {devices.length === 0 ? (
              <Card className="py-12">
                <CardContent className="text-center">
                  <Smartphone className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium mb-1">No devices yet</h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {isAdmin ? "Create your first Android virtual device to get started." : "No devices have been assigned to you yet. Contact your administrator."}
                  </p>
                  {isAdmin && <CreateDeviceDialog profiles={profiles} versions={versions} osTypes={osTypes} onCreated={loadData} />}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onDelete={handleDeleteRequest}
                    onEdit={setEditDevice}
                    onViewScreen={setScreenDevice}
                    deleting={deletingDevice === device.id}
                    isAdmin={isAdmin}
                    selected={selectedDevices.has(device.id)}
                    onToggleSelect={() => toggleDeviceSelect(device.id)}
                    onOpenFileManager={() => setFileManagerDevice(device)}
                    onOpenTerminal={() => setTerminalDevice(device)}
                    onOpenApps={() => setAppManagerDevice(device)}
                    onOpenLogcat={() => setLogcatDevice(device)}
                    onOpenClipboard={() => setClipboardDevice(device)}
                    onOpenNetwork={() => setNetworkDevice(device)}
                    onOpenSnapshots={() => setSnapshotsDevice(device)}
                    onOpenHealth={() => setHealthDevice(device)}
                    onOpenGps={() => setGpsDevice(device)}
                    onOpenSmsCall={() => setSmsCallDevice(device)}
                    onOpenLocale={() => setLocaleDevice(device)}
                    onOpenDebug={() => setDebugDevice(device)}
                    onOpenAutoTest={() => setAutoTestDevice(device)}
                    onOpenAiTest={() => setAiTestDevice(device)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <TemplatesTab profiles={profiles} onLaunch={handleTemplateLaunch} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <AnalyticsTab />
          </TabsContent>

          <TabsContent value="profiles" className="mt-4">
            <ProfilesTab profiles={profiles} onRefresh={loadData} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="mt-4">
              <AdminPanel devices={devices} onRefresh={loadData} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="apikeys" className="mt-4">
              <ApiKeysTab />
            </TabsContent>
          )}

          <TabsContent value="pools" className="mt-4">
            <PoolsTagsTab devices={devices} />
          </TabsContent>

          <TabsContent value="scheduling" className="mt-4">
            <SchedulingTab devices={devices} />
          </TabsContent>

          <TabsContent value="billing" className="mt-4">
            <CostTrackingTab />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="webhooks" className="mt-4">
              <WebhooksTab />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Multi-device action bar */}
      <MultiDeviceActionBar
        selectedIds={selectedDevices}
        onClearSelection={() => setSelectedDevices(new Set())}
        onRefresh={loadData}
      />

      {/* Screen Viewer */}
      {screenDevice && <ScreenViewerDialog device={screenDevice} open={!!screenDevice} onClose={() => setScreenDevice(null)} />}

      {/* Edit Device */}
      {editDevice && <EditDeviceDialog device={editDevice} open={!!editDevice} onClose={() => setEditDevice(null)} onSaved={loadData} />}

      {/* File Manager */}
      {fileManagerDevice && <FileManagerDialog device={fileManagerDevice} open={!!fileManagerDevice} onClose={() => setFileManagerDevice(null)} />}

      {/* ADB Terminal */}
      {terminalDevice && <ADBTerminalDialog device={terminalDevice} open={!!terminalDevice} onClose={() => setTerminalDevice(null)} />}

      {/* App Manager */}
      {appManagerDevice && <AppManagerDialog device={appManagerDevice} open={!!appManagerDevice} onClose={() => setAppManagerDevice(null)} />}

      {/* Logcat Viewer */}
      {logcatDevice && <LogcatDialog device={logcatDevice} open={!!logcatDevice} onClose={() => setLogcatDevice(null)} />}

      {/* Clipboard Sync */}
      {clipboardDevice && <ClipboardDialog device={clipboardDevice} open={!!clipboardDevice} onClose={() => setClipboardDevice(null)} />}

      {/* Network Throttling */}
      {networkDevice && <NetworkThrottleDialog device={networkDevice} open={!!networkDevice} onClose={() => setNetworkDevice(null)} />}

      {/* Snapshots */}
      {snapshotsDevice && <SnapshotsDialog device={snapshotsDevice} open={!!snapshotsDevice} onClose={() => setSnapshotsDevice(null)} />}

      {/* Device Health */}
      {healthDevice && <DeviceHealthDialog device={healthDevice} open={!!healthDevice} onClose={() => setHealthDevice(null)} />}

      {/* GPS Simulation */}
      {gpsDevice && <GPSSimulatorDialog device={gpsDevice} open={!!gpsDevice} onClose={() => setGpsDevice(null)} />}

      {/* SMS/Call Simulation */}
      {smsCallDevice && <SMSCallDialog device={smsCallDevice} open={!!smsCallDevice} onClose={() => setSmsCallDevice(null)} />}

      {/* Locale Switcher */}
      {localeDevice && <LocaleSwitcherDialog device={localeDevice} open={!!localeDevice} onClose={() => setLocaleDevice(null)} />}

      {/* Remote Debug */}
      {debugDevice && <RemoteDebugDialog device={debugDevice} open={!!debugDevice} onClose={() => setDebugDevice(null)} />}

      {/* Automated Testing */}
      {autoTestDevice && <AutoTestDialog device={autoTestDevice} open={!!autoTestDevice} onClose={() => setAutoTestDevice(null)} />}

      {/* AI Test Generator */}
      {aiTestDevice && <AITestGeneratorDialog device={aiTestDevice} open={!!aiTestDevice} onClose={() => setAiTestDevice(null)} />}

      {/* Screenshot Comparison */}
      <ScreenshotCompareDialog devices={devices} open={showScreenshotCompare} onClose={() => setShowScreenshotCompare(false)} />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Delete Device
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this device? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {passcodeRequired && (
              <div className="space-y-2">
                <Label htmlFor="confirm-passcode">Enter delete passcode</Label>
                <Input id="confirm-passcode" type="password" placeholder="Passcode" value={deletePasscodeInput}
                  onChange={(e) => setDeletePasscodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleDeleteConfirm()} autoFocus />
              </div>
            )}
            {deleteError && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={!!deletingDevice || (passcodeRequired && !deletePasscodeInput)}>
              {deletingDevice ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function App() {
  return (
    <DarkModeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </DarkModeProvider>
  );
}

function AppContent() {
  const { auth } = useAuth();
  if (!auth.token) return <LoginPage />;
  return <Dashboard />;
}

export default App;
