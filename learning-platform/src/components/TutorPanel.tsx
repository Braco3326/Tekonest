"use client";

/**
 * TutorPanel — the AI tutor chat. Consumes the AiTutor seam (useAiTutor) and
 * the ProgressStore (weak-spot detection); never calls the API route directly.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCourseBySlug } from "@/data/courses";
import { getPassage } from "@/lib/ai/corpus";
import { CITATION_PATTERN } from "@/lib/ai/prompt";
import type { TutorMessage, WeakSpot } from "@/lib/ai/types";
import { TutorUnavailableError } from "@/lib/ai/types";
import { computeWeakSpots } from "@/lib/ai/weakSpots";
import { useAiTutor, useAuth, useCourseProgress } from "@/lib/providers";

const E3_SLUG = "e3-ptes";

const QUICK_ACTIONS = [
  {
    label: "Expliquer une notion",
    prompt: "J'ai du mal avec la loi de l'inverse du carré. Peux-tu me guider pour la comprendre ?",
  },
  {
    label: "Décortiquer une question d'annale",
    prompt:
      "Guide-moi pas à pas (sans me donner la réponse) : une source produit 94 dB SPL à 1 m en champ libre, quel niveau à 8 m ?",
  },
  {
    label: "Exercices ciblés",
    prompt: "Génère-moi 3 exercices d'entraînement sur les niveaux (dB SPL, dBu, dBFS), avec corrigés.",
  },
  {
    label: "Mes points faibles",
    prompt: "Analyse mes points faibles et propose-moi un plan de révision priorisé.",
  },
];

/** Render a reply, turning [source: id] markers into citation chips. */
function ReplyText({ text }: { text: string }) {
  const parts: Array<{ kind: "text" | "cite"; value: string }> = [];
  let lastIndex = 0;
  for (const match of text.matchAll(CITATION_PATTERN)) {
    if (match.index! > lastIndex) {
      parts.push({ kind: "text", value: text.slice(lastIndex, match.index) });
    }
    parts.push({ kind: "cite", value: match[1] });
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ kind: "text", value: text.slice(lastIndex) });
  }
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.kind === "text") return <span key={i}>{part.value}</span>;
        const passage = getPassage(part.value);
        const chip = (
          <span className="mx-0.5 inline-block rounded-sm bg-cue-dim px-1.5 py-0.5 font-mono text-[10px] text-cue align-baseline">
            {passage ? passage.sourceLabel : part.value}
          </span>
        );
        return passage?.href ? (
          <Link key={i} href={passage.href} title={passage.title}>
            {chip}
          </Link>
        ) : (
          <span key={i} title={part.value}>
            {chip}
          </span>
        );
      })}
    </span>
  );
}

export function TutorPanel({ initialUnitSlug }: { initialUnitSlug?: string } = {}) {
  const tutor = useAiTutor();
  const { user } = useAuth();
  const e3 = useMemo(() => getCourseBySlug(E3_SLUG), []);
  const initialUnit = useMemo(
    () => (initialUnitSlug ? e3?.units.find((u) => u.slug === initialUnitSlug) : undefined),
    [e3, initialUnitSlug]
  );
  const { progress, ready } = useCourseProgress(e3?.id ?? "");
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const weakSpots: WeakSpot[] = useMemo(() => {
    if (!e3 || !ready || !user) return [];
    return computeWeakSpots(e3, progress);
  }, [e3, ready, user, progress]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || streaming) return;
      setError(null);
      setDraft("");
      const history: TutorMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        let reply = "";
        for await (const chunk of tutor.streamReply(
          history,
          { courseSlug: E3_SLUG, unitSlug: initialUnitSlug, weakSpots },
          controller.signal
        )) {
          reply += chunk;
          setMessages([...history, { role: "assistant", content: reply }]);
        }
        if (reply === "") {
          setMessages(history);
          setError("Réponse vide — réessayez.");
        }
      } catch (err) {
        setMessages(history);
        if (err instanceof TutorUnavailableError) {
          setUnavailable(err.message);
        } else if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming, tutor, weakSpots, initialUnitSlug]
  );

  if (unavailable) {
    return (
      <div className="rounded-md border border-line bg-surface p-6">
        <p className="font-mono text-xs uppercase tracking-wide text-amber">Tuteur IA — non configuré</p>
        <p className="mt-3 text-sm leading-relaxed text-ink-mute">{unavailable}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-faint">
          L&apos;administrateur du site doit définir <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> (Claude)
          ou <code className="font-mono text-xs">GEMINI_API_KEY</code> (Gemini) dans les variables
          d&apos;environnement du déploiement.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col rounded-md border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-sm font-semibold text-ink">Tuteur IA</p>
          <p className="font-mono text-[11px] text-ink-faint">
            socratique · ancré dans le cours et le référentiel · ne donne jamais la réponse d&apos;un examen
          </p>
        </div>
        {user && weakSpots.length > 0 && (
          <span className="rounded-full bg-amber-dim px-2.5 py-0.5 font-mono text-[11px] text-amber-bright">
            {weakSpots.length} point{weakSpots.length > 1 ? "s" : ""} faible{weakSpots.length > 1 ? "s" : ""} détecté{weakSpots.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-mute">
              Posez une question sur le cours E3/PTES : le tuteur vous guide sans donner la réponse toute
              faite, et cite ses sources. {!user && "Connectez-vous pour activer la détection de vos points faibles."}
            </p>
            {initialUnit && (
              <p className="inline-flex items-center gap-2 rounded-sm bg-raised px-3 py-1.5 font-mono text-[11px] text-ink-faint">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden="true" />
                contexte : {initialUnit.title}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => send(a.prompt)}
                  className="rounded-sm border border-line bg-raised px-3 py-1.5 text-xs text-ink-mute transition-colors hover:border-amber hover:text-ink"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-md bg-raised px-3.5 py-2.5 text-sm leading-relaxed text-ink"
                  : "max-w-[85%] rounded-md border border-line bg-bg px-3.5 py-2.5 text-sm leading-relaxed text-ink-mute"
              }
            >
              {m.role === "assistant" ? (
                m.content === "" && streaming && i === messages.length - 1 ? (
                  <span className="font-mono text-xs text-ink-faint">le tuteur réfléchit…</span>
                ) : (
                  <ReplyText text={m.content} />
                )
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
            </div>
          </div>
        ))}
        {error && (
          <p role="alert" className="rounded-sm bg-clip-dim px-3 py-2 text-xs text-clip">
            {error}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-line px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Votre question sur le cours E3…"
          maxLength={4000}
          disabled={streaming}
          aria-label="Votre question au tuteur"
          className="min-w-0 flex-1 rounded-sm border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-amber focus:outline-none"
        />
        {streaming ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="rounded-sm border border-line px-4 py-2 font-mono text-xs text-ink-mute hover:border-clip hover:text-clip"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!draft.trim()}
            className="rounded-sm bg-amber px-4 py-2 font-mono text-xs font-semibold text-bg transition-colors hover:bg-amber-bright disabled:opacity-40"
          >
            Envoyer
          </button>
        )}
      </form>
    </div>
  );
}
