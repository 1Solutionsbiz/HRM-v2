"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { navGroups } from "@/config/nav-config";
import { useAuthenticatedUser } from "@/lib/auth-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";

export function AppSidebar() {
  const pathname = usePathname();
  const { role } = useAuthenticatedUser();
  // On mobile the sidebar renders as a Sheet overlay - close it after
  // navigating, same as the bottom-nav "More" sheet does via SheetClose.
  const { isMobile, setOpenMobile } = useSidebar();
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              {/* Collapsed-to-icon desktop state clips this button to a 32x32
                  square, so the full wordmark logo below would render as an
                  unrecognizable sliver - the square icon-only mark takes over
                  there instead, purely via the collapsible=icon data attr. */}
              <Link href="/my-day" onClick={closeOnMobile}>
                <Image
                  src="/hrm-icon.png"
                  alt="1Solutions HRM"
                  width={320}
                  height={320}
                  className="hidden size-7 shrink-0 object-contain group-data-[collapsible=icon]:block"
                  priority
                />
                <Image
                  src="/1solutions-hrm-logo.webp"
                  alt="1Solutions HRM"
                  width={1600}
                  height={611}
                  className="h-8 w-auto group-data-[collapsible=icon]:hidden"
                  priority
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => {
          const items = group.items.filter(
            (item) => !item.roles || item.roles.includes(role),
          );
          if (items.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const isActive =
                      pathname === item.url ||
                      pathname.startsWith(`${item.url}/`);
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                        >
                          <Link href={item.url} onClick={closeOnMobile}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
