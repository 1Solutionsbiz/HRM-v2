"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getPageTitle } from "@/lib/page-title";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  React.useEffect(() => {
    if (!isLoading && !user) router.push("/login");
  }, [isLoading, user, router]);

  // Two states render this placeholder instead of the real shell: hydrating
  // a session from a stored token (must not flash "signed out" before that
  // resolves), and the brief window between deciding there's no user and
  // the redirect effect above actually navigating away. The real shell
  // below assumes an authenticated user (its children read it via
  // useAuthenticatedUser()), so it must never render for either state.
  if (isLoading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Topbar title={getPageTitle(pathname)} />
        <div className="flex-1 space-y-4 p-4 pb-20 sm:p-6 sm:pb-6 md:pb-6">
          {children}
        </div>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}
