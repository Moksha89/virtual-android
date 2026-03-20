import { useState, useEffect, useCallback, createContext, useContext } from "react";
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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium">CPU</span>
          </div>
          <div className="text-2xl font-bold">{status.cpu_cores} Cores</div>
          <div className="text-xs text-muted-foreground">
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

// --- Screen Viewer Dialog ---
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
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{device.name} - Screen</DialogTitle>
              <DialogDescription>
                ADB: {device.ip}:{device.adb_port} | {device.profile_name}
              </DialogDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 px-6 pb-6">
          <iframe
            src={screenUrl}
            className="w-full rounded-lg border border-gray-200"
            style={{ height: "calc(90vh - 100px)" }}
            allow="autoplay; clipboard-write"
            title={`${device.name} Screen`}
          />
        </div>
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

  const loadAdmin = useCallback(async () => {
    try {
      const [u, a] = await Promise.all([api.getUsers(), api.getAssignments()]);
      setUsers(u);
      setAssignments(a);
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
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
              <div className="grid grid-cols-3 gap-3">
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
    </div>
  );
}

// --- Device Card ---
function DeviceCard({
  device,
  onDelete,
  onEdit,
  onViewScreen,
  deleting,
  isAdmin,
}: {
  device: DeviceInfo;
  onDelete: (id: string) => void;
  onEdit: (device: DeviceInfo) => void;
  onViewScreen: (device: DeviceInfo) => void;
  deleting: boolean;
  isAdmin: boolean;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-base">{device.name}</CardTitle>
              <CardDescription className="text-xs">
                {device.profile_name}
              </CardDescription>
            </div>
          </div>
          <StatusBadge status={device.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-gray-500">
            <CircleDot className="w-3.5 h-3.5" />
            <span>Android {device.android_version}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <Cpu className="w-3.5 h-3.5" />
            <span>{device.cpus} CPUs</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <MemoryStick className="w-3.5 h-3.5" />
            <span>
              {device.ram_mb >= 1024
                ? `${(device.ram_mb / 1024).toFixed(0)}GB`
                : `${device.ram_mb}MB`}{" "}
              RAM
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <HardDrive className="w-3.5 h-3.5" />
            <span>{device.storage_gb}GB Storage</span>
          </div>
        </div>
        <Separator />
        <div className="text-xs space-y-1 text-gray-500">
          <div>
            Resolution: {device.x_res}x{device.y_res} @ {device.dpi}dpi
          </div>
          <div>
            ADB: {device.ip}:{device.adb_port}
          </div>
          {device.assigned_users.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="text-gray-400">Assigned:</span>
              {device.assigned_users.map((u) => (
                <Badge key={u} variant="outline" className="text-xs px-1.5 py-0">
                  {u}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          {device.status === "running" && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onViewScreen(device)}
            >
              <Eye className="w-3.5 h-3.5 mr-1" /> View Screen
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(device)}
            >
              <Edit className="w-3.5 h-3.5" />
            </Button>
          )}
          {isAdmin && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onDelete(device.id)}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
        </div>
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
        <Button size="lg" className="gap-2">
          <Plus className="w-5 h-5" /> Create Device
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-xl">Create New Device</DialogTitle>
          <DialogDescription>
            Configure and launch a new Cuttlefish Android virtual device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="device-name">Device Name</Label>
            <Input
              id="device-name"
              placeholder="My Test Device"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
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

        <DialogFooter className="px-6 py-4 border-t border-gray-200 shrink-0">
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

  const isAdmin = auth.user?.role === "admin";

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

  const handleDeleteDevice = async (deviceId: string) => {
    setDeletingDevice(deviceId);
    try {
      await api.deleteDevice(deviceId);
      await loadData();
    } catch (e) {
      console.error("Failed to delete device:", e);
    } finally {
      setDeletingDevice(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600" />
          <p className="text-gray-500">Loading Cuttlefish Dashboard...</p>
        </div>
      </div>
    );
  }

  const runningCount = devices.filter((d) => d.status === "running").length;
  const totalCount = devices.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-600 text-white">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Cuttlefish Device Manager
                </h1>
                <p className="text-sm text-gray-500">
                  Android Virtual Device Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <div className="text-sm font-medium text-gray-700">
                  {runningCount} of {totalCount} devices running
                </div>
                <div className="text-xs text-gray-400">
                  Auto-refreshes every 15s
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshData}
                disabled={refreshing}
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </Button>
              {isAdmin && (
                <CreateDeviceDialog
                  profiles={profiles}
                  versions={versions}
                  osTypes={osTypes}
                  onCreated={loadData}
                />
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                      {auth.user?.username?.[0]?.toUpperCase() || "U"}
                    </div>
                    <span className="hidden md:inline">
                      {auth.user?.username}
                    </span>
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {auth.user?.username}
                    <div className="text-xs font-normal text-gray-500">
                      {auth.user?.role === "admin" ? "Administrator" : "User"}
                    </div>
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

      <main className="container mx-auto px-6 py-6 space-y-6">
        <ServerStatusPanel status={serverStatus} />

        <Tabs defaultValue="devices">
          <TabsList>
            <TabsTrigger value="devices" className="gap-1.5">
              <Smartphone className="w-4 h-4" /> Devices ({totalCount})
            </TabsTrigger>
            <TabsTrigger value="profiles" className="gap-1.5">
              <Zap className="w-4 h-4" /> Hardware Profiles ({profiles.length})
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="gap-1.5">
                <Shield className="w-4 h-4" /> Admin Panel
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
                    {isAdmin
                      ? "Create your first Android virtual device to get started."
                      : "No devices have been assigned to you yet. Contact your administrator."}
                  </p>
                  {isAdmin && (
                    <CreateDeviceDialog
                      profiles={profiles}
                      versions={versions}
                      osTypes={osTypes}
                      onCreated={loadData}
                    />
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {devices.map((device) => (
                  <DeviceCard
                    key={device.id}
                    device={device}
                    onDelete={handleDeleteDevice}
                    onEdit={setEditDevice}
                    onViewScreen={setScreenDevice}
                    deleting={deletingDevice === device.id}
                    isAdmin={isAdmin}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="profiles" className="mt-4">
            <ProfilesTab profiles={profiles} onRefresh={loadData} />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="mt-4">
              <AdminPanel devices={devices} onRefresh={loadData} />
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Screen Viewer */}
      {screenDevice && (
        <ScreenViewerDialog
          device={screenDevice}
          open={!!screenDevice}
          onClose={() => setScreenDevice(null)}
        />
      )}

      {/* Edit Device */}
      {editDevice && (
        <EditDeviceDialog
          device={editDevice}
          open={!!editDevice}
          onClose={() => setEditDevice(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { auth } = useAuth();

  if (!auth.token) {
    return <LoginPage />;
  }

  return <Dashboard />;
}

export default App;
