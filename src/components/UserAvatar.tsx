import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isRecentlyActive } from "@/hooks/use-presence";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-20 text-xl",
} as const;

export function UserAvatar({
  name,
  image,
  size = "md",
  lastSeenAt,
  showPresence = false,
  className,
}: {
  name: string | null | undefined;
  image: string | null | undefined;
  size?: keyof typeof SIZES;
  lastSeenAt?: string | number | null;
  showPresence?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <Avatar className={cn(SIZES[size], "border border-border/60")}>
        {image ? <AvatarImage src={image} alt={name ?? "Avatar"} /> : null}
        <AvatarFallback className="bg-brand-soft font-semibold text-brand-strong">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      {showPresence && isRecentlyActive(lastSeenAt) && (
        <span
          className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background"
          aria-label="Online"
        />
      )}
    </div>
  );
}
