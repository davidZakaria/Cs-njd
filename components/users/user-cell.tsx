import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getUserInitials } from "@/lib/users/user-display";

export function UserCell({ name, email }: { name: string; email: string }) {
  const initials = getUserInitials(name);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar size="sm" className="shadow-sm">
        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate font-semibold text-foreground">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{email}</p>
      </div>
    </div>
  );
}
