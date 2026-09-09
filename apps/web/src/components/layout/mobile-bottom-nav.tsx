"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { getMobilePrimaryNav, navGroups } from "@/config/nav-config";
import { useAuthenticatedUser } from "@/lib/auth-context";
import { toneClasses, cardToneClasses, type Tone } from "@/lib/tone";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/** Cycled by position so items within a group read as visually distinct, not tied to any per-item meaning. */
const TONE_CYCLE: Tone[] = ["primary", "success", "warning", "violet", "orange", "teal", "destructive"];

/**
 * Bottom tab bar for mobile - the four highest-frequency employee actions
 * get a one-tap home, everything else (including role-specific items) lives
 * one tap away in the "More" sheet. Hidden at md+ where the sidebar takes over.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const { role } = useAuthenticatedUser();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const mobilePrimaryNav = getMobilePrimaryNav(role);

  return (
    <nav className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t backdrop-blur md:hidden">
      {mobilePrimaryNav.map((item) => {
        const isActive =
          pathname === item.url || pathname.startsWith(`${item.url}/`);
        return (
          <Link
            key={item.url}
            href={item.url}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              isActive ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon
              className={cn("size-5", isActive && "fill-primary/15")}
            />
            {item.title}
          </Link>
        );
      })}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
        >
          <Menu className="size-5" />
          More
        </button>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-6">
            {navGroups.map((group) => {
              const items = group.items.filter(
                (item) => !item.roles || item.roles.includes(role),
              );
              if (items.length === 0) return null;
              return (
                <div key={group.label} className="space-y-1.5">
                  <p className="text-muted-foreground px-1 text-xs font-medium">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((item, i) => {
                      const tone = TONE_CYCLE[i % TONE_CYCLE.length]!;
                      return (
                        <SheetClose asChild key={item.url}>
                          <Link
                            href={item.url}
                            className={cn(
                              "flex flex-col items-center gap-1.5 rounded-lg p-3 text-center text-xs font-medium",
                              cardToneClasses[tone],
                            )}
                          >
                            <div
                              className={cn(
                                "flex size-9 items-center justify-center rounded-full",
                                toneClasses[tone],
                              )}
                            >
                              <item.icon className="size-4.5" />
                            </div>
                            {item.title}
                          </Link>
                        </SheetClose>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
