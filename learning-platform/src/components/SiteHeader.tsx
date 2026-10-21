"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/providers";

const NAV = [
  { href: "/cours", label: "Cours" },
  { href: "/tuteur", label: "Tuteur IA" },
  { href: "/annales", label: "Annales" },
  { href: "/a-propos", label: "Sources" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-sm px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-amber-dim text-amber-bright"
                    : "text-ink-mute hover:bg-overlay hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {!loading && user ? (
            <>
              <Link
                href="/certificats"
                className="rounded-sm px-3 py-1.5 text-sm text-ink-mute transition-colors hover:bg-overlay hover:text-ink"
              >
                Mes certificats
              </Link>
              <Link
                href="/profil"
                className="flex items-center gap-2 rounded-sm border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:border-line-strong"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber font-display text-[11px] font-bold text-bg">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                {user.name.split(" ")[0]}
              </Link>
            </>
          ) : !loading ? (
            <>
              <Link
                href="/connexion"
                className="rounded-sm px-3 py-1.5 text-sm text-ink-mute transition-colors hover:text-ink"
              >
                Connexion
              </Link>
              <Link
                href="/inscription"
                className="rounded-sm bg-amber px-3.5 py-1.5 text-sm font-medium text-bg transition-colors hover:bg-amber-bright"
              >
                Commencer
              </Link>
            </>
          ) : null}
        </div>
        {/* Mobile */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-line text-ink md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            {open ? (
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>
      {open && (
        <nav className="border-t border-line bg-surface px-4 py-3 md:hidden" aria-label="Navigation mobile">
          <div className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-sm px-3 py-2 text-sm text-ink-mute hover:bg-overlay hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/certificats" onClick={() => setOpen(false)} className="rounded-sm px-3 py-2 text-sm text-ink-mute hover:bg-overlay hover:text-ink">
                  Mes certificats
                </Link>
                <Link href="/profil" onClick={() => setOpen(false)} className="rounded-sm px-3 py-2 text-sm text-ink-mute hover:bg-overlay hover:text-ink">
                  Profil — {user.name}
                </Link>
              </>
            ) : (
              <>
                <Link href="/connexion" onClick={() => setOpen(false)} className="rounded-sm px-3 py-2 text-sm text-ink-mute hover:bg-overlay hover:text-ink">
                  Connexion
                </Link>
                <Link href="/inscription" onClick={() => setOpen(false)} className="rounded-sm bg-amber px-3 py-2 text-sm font-medium text-bg">
                  Commencer gratuitement
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
