"use client";

/**
 * E4 seam — embeds the Audio Simulator (separate deployment) when reachable,
 * with a graceful "bientôt" state otherwise. The target URL is configurable
 * via NEXT_PUBLIC_SIM_URL (defaults to the production simulator domain).
 */

import { useEffect, useState } from "react";

const SIM_URL = process.env.NEXT_PUBLIC_SIM_URL ?? "https://sim.teknest.fr";
const PROBE_TIMEOUT_MS = 5000;

type SimState = "checking" | "up" | "down";

export function SimulatorEmbed() {
  const [state, setState] = useState<SimState>("checking");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    // no-cors: an opaque response still means the host is reachable.
    fetch(SIM_URL, { mode: "no-cors", signal: controller.signal })
      .then(() => setState("up"))
      .catch(() => setState("down"))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="mt-6 rounded-md border border-line bg-surface p-5">
        <p className="font-mono text-xs text-ink-faint" role="status">
          Vérification de la disponibilité du simulateur…
        </p>
      </div>
    );
  }

  if (state === "down") {
    return (
      <div className="mt-6 rounded-md border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-dim px-2.5 py-0.5 font-mono text-[11px] text-amber-bright">
            bientôt
          </span>
          <p className="font-display text-base font-semibold text-ink">
            Simulateur audio 3D — en cours de raccordement
          </p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-mute">
          Le simulateur d&apos;installation son (consoles, micros, câblage, gain staging) sera
          intégré ici, directement dans le cours E4. Il sera accessible sur{" "}
          <span className="font-mono text-xs text-ink">{SIM_URL.replace("https://", "")}</span>{" "}
          dès sa mise en service.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-md border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />
          <p className="font-display text-sm font-semibold text-ink">Simulateur audio 3D</p>
        </div>
        <a
          href={SIM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs text-cue underline-offset-4 hover:underline"
        >
          Plein écran ↗
        </a>
      </div>
      {open ? (
        <iframe
          src={SIM_URL}
          title="Simulateur audio 3D Tech Nest"
          className="aspect-video w-full border-0"
          loading="lazy"
          allow="fullscreen; pointer-lock; xr-spatial-tracking"
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-bg">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-sm bg-amber px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-amber-bright"
          >
            Lancer le simulateur
          </button>
        </div>
      )}
    </div>
  );
}
