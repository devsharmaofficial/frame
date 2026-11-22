"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { clearToken, getToken, type User } from "@/lib/api";
import { api } from "@/lib/api";
import { cls } from "@/lib/utils";
import {
  IconBell,
  IconBot,
  IconCheckCircle,
  IconClock,
  IconCreditCard,
  IconFlask,
  IconGrid,
  IconLogout,
  IconReceipt,
  IconSettings,
  IconShield,
} from "@/components/icons";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

function useAuthGuard(): { authed: boolean } {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/signin");
    } else {
      setAuthed(true);
    }
  }, [router]);

  return { authed };
}

function avatarLabel(name?: string): string {
  if (!name) return "?";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { authed } = useAuthGuard();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("User");
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    const cached = window.localStorage.getItem("frame_user");
    if (cached) {
      try {
        const u = JSON.parse(cached) as User;
        setUser(u);
        setUserName(u.name);
      } catch {
        /* ignore */
      }
    }
    api
      .get<{ user: User }>("/auth/me")
      .then((res) => {
        setUser(res.user);
        setUserName(res.user.name);
        window.localStorage.setItem("frame_user", JSON.stringify(res.user));
      })
      .catch(() => {
        /* keep cached */
      });
  }, []);

  useEffect(() => {
    // Unread notification count for the topbar dot. Absent backend (404)
    // or unauthenticated state simply hides the dot — never an error.
    if (!getToken()) {
      setUnreadCount(null);
      return;
    }
    api
      .get<Array<{ read?: boolean; isRead?: boolean }>>("/notifications?limit=25")
      .then((items) => {
        const list = Array.isArray(items) ? items : [];
        const unread = list.filter((n) => n.read !== true && n.isRead !== true).length;
        setUnreadCount(unread);
      })
      .catch(() => setUnreadCount(null));
  }, [pathname]);

  const navSections: Array<{ title: string; items: NavItem[] }> = [
    {
      title: "Operations",
      items: [
        { href: "/dashboard", label: "Overview", icon: <IconGrid /> },
        { href: "/dashboard/agents", label: "Agents", icon: <IconBot /> },
        { href: "/dashboard/policies", label: "Policies", icon: <IconShield /> },
        { href: "/dashboard/intents", label: "Payments", icon: <IconCreditCard /> },
        { href: "/dashboard/approvals", label: "Approvals", icon: <IconCheckCircle /> },
      ],
    },
    {
      title: "Ledger",
      items: [
        { href: "/dashboard/transactions", label: "Transactions", icon: <IconReceipt /> },
        { href: "/dashboard/audit", label: "Audit", icon: <IconClock /> },
        { href: "/dashboard/notifications", label: "Notifications", icon: <IconBell /> },
        { href: "/dashboard/demo", label: "End-to-end demo", icon: <IconFlask /> },
        { href: "/dashboard/settings", label: "Settings", icon: <IconSettings /> },
      ],
    },
  ];

  if (!authed) {
    return null;
  }

  const isActive = (href: string): boolean => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const handleLogout = () => {
    clearToken();
    window.localStorage.removeItem("frame_user");
    router.replace("/signin");
  };

  const topTitle = navSections
    .flatMap((s) => s.items)
    .find((i) => isActive(i.href))?.label;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-mark">F</div>
          <div>
            <div className="sidebar-brand-name">Frame</div>
            <div className="sidebar-brand-sub">Payment infra</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navSections.map((section) => (
            <div className="sidebar-section" key={section.title}>
              <p className="sidebar-section-title">{section.title}</p>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cls("nav-link", isActive(item.href) && "active")}
                  aria-current={isActive(item.href) ? "page" : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="mono" style={{ fontSize: 11 }}>
            frame / web console
          </div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">{topTitle ?? "Dashboard"}</div>
          <div className="topbar-right">
            <span className="env-pill" title="Sandbox environment">
              sandbox
            </span>
            <Link
              href="/dashboard/notifications"
              className="notif-bell"
              title="Notifications"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
            >
              <IconBell style={{ width: 16, height: 16 }} />
              {unreadCount != null && unreadCount > 0 ? (
                <span className="notif-dot" aria-hidden>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <div className="topbar-user">
              <div className="topbar-user-avatar" aria-hidden>
                {avatarLabel(user?.name ?? userName)}
              </div>
              <span>{userName}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Sign out">
              <IconLogout style={{ width: 14, height: 14 }} />
              Sign out
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}