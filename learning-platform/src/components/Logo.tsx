import Link from "next/link";

/** Tech Nest wordmark — a fader cap forming the "T", amber on charcoal. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 group"
      aria-label={compact ? "Tech Nest — accueil" : undefined}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="1" y="1" width="26" height="26" rx="5" fill="var(--tn-raised)" stroke="var(--tn-line-strong)" />
        {/* three fader tracks */}
        <line x1="8" y1="6" x2="8" y2="22" stroke="var(--tn-line-strong)" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="14" y1="6" x2="14" y2="22" stroke="var(--tn-line-strong)" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="20" y1="6" x2="20" y2="22" stroke="var(--tn-line-strong)" strokeWidth="1.6" strokeLinecap="round" />
        {/* fader caps */}
        <rect x="5.4" y="9" width="5.2" height="3.4" rx="1" fill="var(--tn-amber)" />
        <rect x="11.4" y="15" width="5.2" height="3.4" rx="1" fill="var(--tn-signal)" />
        <rect x="17.4" y="11.5" width="5.2" height="3.4" rx="1" fill="var(--tn-cue)" />
      </svg>
      {!compact && (
        <span className="font-display font-semibold tracking-tight text-[17px] text-ink group-hover:text-amber-bright transition-colors">
          Tech<span className="text-amber"> Nest</span>
        </span>
      )}
    </Link>
  );
}
