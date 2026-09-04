import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { useAuth } from "@/hooks/use-auth";
import { formatRelative } from "@/lib/format";
import { useMutation, useQuery } from "convex/react";
import {
  Loader2,
  Lock,
  Palette,
  Save,
  Shield,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type Settings = FunctionReturnType<typeof api.settings.mySettings>;
type Device = FunctionReturnType<typeof api.sync.myDevices>[number];

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const settings = useQuery(api.settings.mySettings);
  const devices = useQuery(api.sync.myDevices);

  const updateProfile = useMutation(api.users.updateProfile);
  const updateSettings = useMutation(api.settings.updateSettings);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const registerUpload = useMutation(api.media.registerUpload);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setUsername(user.username ?? "");
      setBio(user.bio ?? "");
    }
  }, [user]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await updateProfile({ name, username, bio });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function uploadAvatar(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image is larger than 10 MB");
      return;
    }
    try {
      const url = await generateUploadUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { storageId } = (await res.json()) as { storageId: string };
      const mediaId = await registerUpload({
        kind: "image",
        name: file.name || "avatar",
        mimeType: file.type || "image/*",
        size: file.size,
        storageId: storageId as never,
      });
      await updateProfile({ image: mediaId as unknown as string });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    }
  }

  async function patchSettings(patch: Record<string, unknown>) {
    try {
      await updateSettings(patch);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save setting");
    }
  }

  const dirty = Boolean(
    user &&
      (name !== (user.name ?? "") ||
        username !== (user.username ?? "") ||
        bio !== (user.bio ?? "")),
  );

  return (
    <div className="mx-auto h-full w-full max-w-2xl space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin">
      <header>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile, privacy, storage, and devices.
        </p>
      </header>

      {/* profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4" /> Profile
          </CardTitle>
          <CardDescription>How you appear across EchoLine.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <UserAvatar name={name || user?.name} image={user?.image} size="xl" />
            <div className="space-y-1.5">
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 size-3.5" /> Change photo
              </Button>
              <p className="text-xs text-muted-foreground">JPG or PNG, up to 10 MB.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
                e.target.value = "";
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="lowercase_letters"
                maxLength={20}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="A few words about you"
            />
            <p className="text-right text-xs text-muted-foreground">{bio.length}/200</p>
          </div>
          <Button onClick={saveProfile} disabled={!dirty || savingProfile}>
            {savingProfile ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save profile
          </Button>
        </CardContent>
      </Card>

      {/* privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4" /> Privacy
          </CardTitle>
          <CardDescription>Control who can reach you and what they see.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingSelect
            id="lastSeen"
            label="Last seen & online"
            hint="Shown on your profile and chats"
            value={settings?.lastSeenVisibility ?? "everyone"}
            options={[
              ["everyone", "Everyone"],
              ["friends", "My friends"],
              ["nobody", "Nobody"],
            ]}
            onChange={(v) => patchSettings({ lastSeenVisibility: v })}
          />
          <SettingSelect
            id="photo"
            label="Profile photo"
            value={settings?.profilePhotoVisibility ?? "everyone"}
            options={[
              ["everyone", "Everyone"],
              ["friends", "My friends"],
              ["nobody", "Nobody"],
            ]}
            onChange={(v) => patchSettings({ profilePhotoVisibility: v })}
          />
          <SettingSelect
            id="story"
            label="Story visibility"
            value={settings?.storyVisibility ?? "friends"}
            options={[
              ["friends", "My friends"],
              ["everyone", "Everyone"],
            ]}
            onChange={(v) => patchSettings({ storyVisibility: v })}
          />
          <SettingSelect
            id="requests"
            label="Friend requests from"
            value={settings?.friendRequestsFrom ?? "everyone"}
            options={[
              ["everyone", "Everyone"],
              ["friendsOfFriends", "Friends of friends"],
              ["nobody", "Nobody"],
            ]}
            onChange={(v) => patchSettings({ friendRequestsFrom: v })}
          />
          <SettingSelect
            id="messages"
            label="Messages from"
            value={settings?.messagesFrom ?? "friends"}
            options={[
              ["friends", "Friends only"],
              ["everyone", "Everyone"],
            ]}
            onChange={(v) => patchSettings({ messagesFrom: v })}
          />
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="receipts">Read receipts</Label>
              <p className="text-xs text-muted-foreground">
                Others see when you've read their messages
              </p>
            </div>
            <Switch
              id="receipts"
              checked={settings?.readReceiptsEnabled ?? true}
              onCheckedChange={(v) => patchSettings({ readReceiptsEnabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="typing">Typing indicator</Label>
              <p className="text-xs text-muted-foreground">
                Show others when you're typing
              </p>
            </div>
            <Switch
              id="typing"
              checked={settings?.typingIndicatorEnabled ?? true}
              onCheckedChange={(v) => patchSettings({ typingIndicatorEnabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* storage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="size-4" /> Storage
          </CardTitle>
          <CardDescription>Media download and retention preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingSelect
            id="autodl"
            label="Auto-download media"
            value={settings?.autoDownloadMedia ?? "wifi"}
            options={[
              ["always", "On any network"],
              ["wifi", "Wi-Fi only"],
              ["never", "Never"],
            ]}
            onChange={(v) => patchSettings({ autoDownloadMedia: v })}
          />
          <SettingSelect
            id="keepdays"
            label="Keep media for"
            value={String(settings?.keepMediaDays ?? 30)}
            options={[
              ["7", "7 days"],
              ["30", "30 days"],
              ["90", "90 days"],
              ["365", "1 year"],
            ]}
            onChange={(v) => patchSettings({ keepMediaDays: Number(v) })}
          />
          <p className="text-xs text-muted-foreground">
            Disappearing messages and stories purge automatically on the server.
          </p>
        </CardContent>
      </Card>

      {/* devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4" /> Devices
          </CardTitle>
          <CardDescription>
            Places where you've signed in recently (multi-device sync).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices === undefined ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Only this device so far.</p>
          ) : (
            <ul className="space-y-2">
              {devices.map((d: Device) => (
                <li key={d._id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Smartphone className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.platform ?? "Unknown device"}</p>
                    <p className="text-xs text-muted-foreground">
                      synced {formatRelative(d.lastSyncedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* account */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="size-4" /> Account
          </CardTitle>
          <CardDescription>Sign out here — deletion comes with the admin era (Part 2).</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => void signOut()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function SettingSelect({
  id,
  label,
  hint,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div className="min-w-0">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
