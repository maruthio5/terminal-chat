import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { usePresenceHeartbeat } from "@/hooks/use-presence";
import { formatRelative } from "@/lib/format";
import { useLocalFirst, type ThemeMode } from "@/lib/store";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import type { NotificationItem } from "@/components/NotificationRow";
import {
  Bell,
  Loader2,
  LogOut,
  MessageCircle,
  Moon,
  Settings as SettingsIcon,
  Sun,
  User,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { useMutation, useQuery } from "convex/react";
import { NotificationRow } from "@/components/NotificationRow";

const NAV = [
  { to: "/app", label: "Chats", icon: MessageCircle, end: true },
  { to: "/app/friends", label: "Friends", icon: Users, end: false },
  { to: "/app/stories", label: "Stories", icon: User, end: false },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon, end: false },
] as const;

function ThemeToggle() {
  const theme = useLocalFirst((s) => s.theme);
  const setTheme = useLocalFirst((s) => s.setTheme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const apply = (mode: ThemeMode) => {
    setTheme(mode);
    const root = document.documentElement;
    const dark =
      mode === "dark" ||
      (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", dark);
  };

  // apply persisted theme on mount
  useEffect(() => {
    if (mounted) apply(theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Theme">
          {mounted && theme === "dark" ? (
            <Moon className="size-4" />
          ) : mounted && theme === "light" ? (
            <Sun className="size-4" />
          ) : (
            <Sun className="size-4 opacity-60" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => apply("light")}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => apply("dark")}>Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => apply("system")}>System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const notifications = useQuery(api.notifications.list);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const markRead = useMutation(api.notifications.markRead);
  const navigate = useNavigate();

  const unread = useMemo(
    () => (notifications ?? []).filter((n) => !n.readAt).length,
    [notifications],
  );

  const handleOpen = (n: NotificationItem) => {
    if (!n.readAt) void markRead({ notificationId: n._id });
    setOpen(false);
    if (n.conversationId) navigate("/app");
    else if (n.storyId) navigate("/app/stories");
    else navigate("/app/friends");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8" aria-label="Notifications">
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-contrast">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="flex items-center justify-between px-2 pb-1">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void markAllRead()}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications === undefined ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              You're all caught up ✨
            </p>
          ) : (
            <div className="space-y-0.5">
              {notifications.map((n) => (
                <NotificationRow
                  key={n._id}
                  n={n}
                  unread={!n.readAt}
                  muted={n.kind === "message" && n.conversationId !== undefined}
                  onClick={() => handleOpen(n)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  usePresenceHeartbeat();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Could not sign out. Please try again.");
    }
  };

  const isChatRoute =
    location.pathname === "/app" || location.pathname.startsWith("/app/c/");
  const isMobileNavVisible = true;

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-sm font-black text-brand-contrast">
            E
          </span>
          <span className="hidden text-base font-bold tracking-tight sm:block">EchoLine</span>
        </NavLink>

        <nav className="ml-2 hidden items-center gap-1 sm:flex" aria-label="Primary">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive && "bg-muted text-foreground",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <NotificationsBell />
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-1 rounded-full outline-none ring-ring focus-visible:ring-2" aria-label="Account menu">
                  <UserAvatar name={user.name} image={user.image} size="sm" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-medium">{user.name ?? "Anonymous"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.username ? `@${user.username}` : user.email ?? ""}
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/app/settings")}>
                  <SettingsIcon className="mr-2 size-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* mobile bottom nav */}
      <nav
        className="flex h-14 shrink-0 items-center justify-around border-t bg-background sm:hidden"
        aria-label="Mobile"
      >
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-muted-foreground",
                isActive && "text-brand",
              )
            }
          >
            <Icon className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      {isChatRoute && isMobileNavVisible ? null : null}
    </div>
  );
}
