import type { LessonBlock } from "@/data/types";
import { Figure } from "./figures/FigureRegistry";
import type { ReactNode } from "react";

/** Minimal inline renderer: **bold** and *italic*. */
export function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={key++} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = m.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const NOTE_STYLE = {
  info: { border: "border-cue", bg: "bg-cue-dim", label: "À savoir", labelColor: "text-cue" },
  warning: { border: "border-clip", bg: "bg-clip-dim", label: "Attention", labelColor: "text-clip" },
  exam: { border: "border-amber", bg: "bg-amber-dim", label: "Réflexe examen", labelColor: "text-amber-bright" },
} as const;

function Block({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "h2":
      return (
        <h2 className="mt-10 mb-4 font-display text-2xl font-semibold tracking-tight text-ink">
          {block.text}
        </h2>
      );
    case "h3":
      return (
        <h3 className="mt-8 mb-3 font-display text-lg font-semibold text-ink">
          {block.text}
        </h3>
      );
    case "p":
      return <p className="my-4 leading-relaxed text-ink-mute">{inline(block.text)}</p>;
    case "list":
      return block.ordered ? (
        <ol className="my-4 list-decimal space-y-2 pl-6 leading-relaxed text-ink-mute marker:text-amber">
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ol>
      ) : (
        <ul className="my-4 list-disc space-y-2 pl-6 leading-relaxed text-ink-mute marker:text-amber">
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="my-6 overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse text-sm">
            {block.caption && (
              <caption className="border-b border-line bg-raised px-4 py-2.5 text-left font-display text-sm font-medium text-ink">
                {block.caption}
              </caption>
            )}
            <thead>
              <tr className="bg-raised">
                {block.header.map((h, i) => (
                  <th key={i} className="border-b border-line px-4 py-2.5 text-left font-medium text-ink-mute">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="odd:bg-surface even:bg-bg">
                  {row.map((cell, j) => (
                    <td key={j} className="border-b border-line px-4 py-2.5 text-ink-mute last:border-b-0">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "formula":
      return (
        <div className="my-6 rounded-md border border-line bg-surface px-5 py-4 text-center">
          <code className="font-mono text-lg text-amber-bright">{block.latexLike}</code>
          {block.label && <p className="mt-2 text-xs text-ink-faint">{block.label}</p>}
        </div>
      );
    case "example":
      return (
        <div className="my-6 overflow-hidden rounded-md border border-line">
          <div className="flex items-center gap-2 border-b border-line bg-raised px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-signal" aria-hidden="true" />
            <span className="font-display text-sm font-semibold text-ink">{block.title}</span>
          </div>
          <div className="space-y-3 bg-surface px-4 py-4 text-sm">
            <p className="leading-relaxed text-ink">{inline(block.problem)}</p>
            <ol className="list-decimal space-y-1.5 pl-5 text-ink-mute marker:text-ink-faint">
              {block.steps.map((s, i) => (
                <li key={i} className="font-mono text-[13px] leading-relaxed">{s}</li>
              ))}
            </ol>
            <p className="rounded-sm bg-signal-dim px-3 py-2 leading-relaxed text-signal">
              {inline(block.answer)}
            </p>
          </div>
        </div>
      );
    case "note": {
      const s = NOTE_STYLE[block.tone];
      return (
        <div className={`my-6 rounded-md border-l-2 ${s.border} ${s.bg} px-4 py-3`}>
          <p className={`mb-1 font-display text-xs font-semibold uppercase tracking-wider ${s.labelColor}`}>
            {s.label}
          </p>
          <p className="text-sm leading-relaxed text-ink-mute">{inline(block.text)}</p>
        </div>
      );
    }
    case "figure":
      return <Figure figureId={block.figureId} caption={block.caption} />;
  }
}

export function LessonRenderer({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div>
      {blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </div>
  );
}
