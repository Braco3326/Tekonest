import type { JSX } from "react";

/**
 * Diagram registry — lesson data references figures by id
 * ({ type: "figure", figureId }); the SVGs live here as components.
 * Content stays pure data; visuals stay code.
 */

const AXIS = "var(--tn-line-strong)";
const INK = "var(--tn-ink-mute)";
const AMBER = "var(--tn-amber)";
const SIGNAL = "var(--tn-signal)";
const CUE = "var(--tn-cue)";
const CLIP = "var(--tn-clip)";

function FletcherMunson() {
  return (
    <svg viewBox="0 0 560 300" role="img" aria-label="Courbes isosoniques" className="w-full">
      <g fontFamily="var(--font-jetbrains-mono)" fontSize="11" fill={INK}>
        {/* axes */}
        <line x1="60" y1="20" x2="60" y2="250" stroke={AXIS} />
        <line x1="60" y1="250" x2="530" y2="250" stroke={AXIS} />
        <text x="20" y="30">dB SPL</text>
        <text x="480" y="272">f (Hz)</text>
        {[
          [60, "20"],
          [170, "100"],
          [290, "1k"],
          [400, "5k"],
          [510, "20k"],
        ].map(([x, label]) => (
          <g key={label as string}>
            <line x1={x as number} y1="250" x2={x as number} y2="254" stroke={AXIS} />
            <text x={(x as number) - 8} y="268">{label}</text>
          </g>
        ))}
        {[
          [250, "0"],
          [190, "40"],
          [130, "80"],
          [70, "120"],
        ].map(([y, label]) => (
          <g key={label as string}>
            <line x1="56" y1={y as number} x2="60" y2={y as number} stroke={AXIS} />
            <text x="30" y={(y as number) + 4}>{label}</text>
          </g>
        ))}
        {/* isophone curves: high in bass, dip at 3-4k, slight rise at high end */}
        <path
          d="M 70 130 C 150 195, 220 208, 290 205 C 340 203, 360 218, 395 212 C 440 204, 470 190, 510 200"
          fill="none" stroke={AMBER} strokeWidth="2.2"
        />
        <path
          d="M 70 90 C 150 150, 220 165, 290 162 C 340 160, 360 176, 395 170 C 440 162, 470 148, 510 158"
          fill="none" stroke={SIGNAL} strokeWidth="1.6"
        />
        <path
          d="M 70 52 C 150 105, 220 122, 290 120 C 340 118, 360 132, 395 127 C 440 120, 470 106, 510 116"
          fill="none" stroke={CUE} strokeWidth="1.6"
        />
        <text x="300" y="196" fill={AMBER}>40 phones</text>
        <text x="300" y="152" fill={SIGNAL}>60 phones</text>
        <text x="300" y="110" fill={CUE}>80 phones</text>
        {/* sensitivity zone */}
        <rect x="355" y="20" width="70" height="230" fill="rgba(232,176,75,0.06)" />
        <text x="345" y="38" fill={AMBER}>2–5 kHz : sensibilité max</text>
      </g>
    </svg>
  );
}

function BalancedLine() {
  return (
    <svg viewBox="0 0 560 250" role="img" aria-label="Liaison symétrique" className="w-full">
      <g fontFamily="var(--font-jetbrains-mono)" fontSize="11" fill={INK}>
        {/* source */}
        <rect x="20" y="80" width="90" height="90" rx="6" fill="var(--tn-raised)" stroke={AXIS} />
        <text x="34" y="70">Source (XLR)</text>
        {/* receiver */}
        <rect x="440" y="80" width="100" height="90" rx="6" fill="var(--tn-raised)" stroke={AXIS} />
        <text x="446" y="70">Ampli différentiel</text>
        <text x="458" y="130" fontSize="16" fill="var(--tn-ink)">+ −</text>
        {/* hot / cold / shield */}
        <line x1="110" y1="100" x2="440" y2="100" stroke={SIGNAL} strokeWidth="2" />
        <line x1="110" y1="130" x2="440" y2="130" stroke={CUE} strokeWidth="2" />
        <line x1="110" y1="160" x2="440" y2="160" stroke={AXIS} strokeWidth="1.4" strokeDasharray="5 4" />
        <text x="130" y="94" fill={SIGNAL}>2 · point chaud  (signal +)</text>
        <text x="130" y="124" fill={CUE}>3 · point froid  (signal −, en opposition)</text>
        <text x="130" y="176" fill={INK}>1 · masse / blindage</text>
        {/* interference */}
        {[200, 270, 340].map((x) => (
          <g key={x}>
            <path d={`M ${x} 40 l 0 46`} stroke={CLIP} strokeWidth="1.6" markerEnd="url(#arr)" />
            <path d={`M ${x + 18} 40 l 0 76`} stroke={CLIP} strokeWidth="1.6" />
          </g>
        ))}
        <text x="195" y="30" fill={CLIP}>parasites (identiques sur les 2 conducteurs)</text>
        <text x="330" y="226" fill={SIGNAL}>(+) − (−) → le signal double, les parasites s&apos;annulent</text>
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
            <path d="M0,0 L6,0 L3,6 z" fill={CLIP} />
          </marker>
        </defs>
      </g>
    </svg>
  );
}

function Polar({ cx, label, d }: { cx: number; label: string; d: string }) {
  return (
    <g>
      {[52, 36, 20].map((r) => (
        <circle key={r} cx={cx} cy="105" r={r} fill="none" stroke={AXIS} strokeWidth="0.8" />
      ))}
      <line x1={cx - 56} y1="105" x2={cx + 56} y2="105" stroke={AXIS} strokeWidth="0.6" />
      <line x1={cx} y1="49" x2={cx} y2="161" stroke={AXIS} strokeWidth="0.6" />
      <path d={d} fill="rgba(232,176,75,0.15)" stroke={AMBER} strokeWidth="1.8" />
      <text x={cx} y="190" textAnchor="middle" fill={INK}>{label}</text>
      <text x={cx} y="40" textAnchor="middle" fill={INK} fontSize="9">0°</text>
    </g>
  );
}

function MicDirectivity() {
  // circles/cardioid/figure-8 drawn around (cx,105), r max 52, 0° pointing up
  return (
    <svg viewBox="0 0 560 200" role="img" aria-label="Diagrammes polaires de directivité" className="w-full">
      <g fontFamily="var(--font-jetbrains-mono)" fontSize="11">
        <Polar cx={100} label="Omnidirectionnel" d="M 100 53 A 52 52 0 1 1 99.9 53 Z" />
        {/* cardioid: r = 26(1+cos θ), θ from vertical */}
        <Polar
          cx={280}
          label="Cardioïde"
          d="M 280 53 C 318 53, 336 84, 330 110 C 324 136, 300 150, 280 150 C 260 150, 236 136, 230 110 C 224 84, 242 53, 280 53 Z"
        />
        {/* figure 8 */}
        <Polar
          cx={460}
          label="Bidirectionnel (8)"
          d="M 460 105 C 436 45, 484 45, 460 105 C 436 165, 484 165, 460 105 Z"
        />
      </g>
    </svg>
  );
}

function SamplingQuantization() {
  // sine wave + sample stems + quantization grid
  const samples: [number, number][] = [];
  for (let i = 0; i <= 22; i++) {
    const x = 60 + i * 20;
    const y = 125 - 70 * Math.sin((i / 22) * Math.PI * 2.2);
    samples.push([x, Math.round((y - 55) / 17.5) * 17.5 + 55]);
  }
  return (
    <svg viewBox="0 0 560 260" role="img" aria-label="Échantillonnage et quantification" className="w-full">
      <g fontFamily="var(--font-jetbrains-mono)" fontSize="11" fill={INK}>
        {/* quantization levels */}
        {Array.from({ length: 9 }, (_, i) => 55 + i * 17.5).map((y) => (
          <line key={y} x1="60" y1={y} x2="520" y2={y} stroke={AXIS} strokeWidth="0.5" strokeDasharray="2 4" />
        ))}
        <line x1="60" y1="230" x2="520" y2="230" stroke={AXIS} />
        {/* analog wave */}
        <path
          d={
            "M 60 125 " +
            Array.from({ length: 92 }, (_, i) => {
              const x = 60 + i * 5;
              const y = 125 - 70 * Math.sin(((i * 5) / 440) * Math.PI * 2.2);
              return `L ${x} ${y.toFixed(1)}`;
            }).join(" ")
          }
          fill="none"
          stroke={CUE}
          strokeWidth="1.8"
        />
        {/* samples */}
        {samples.map(([x, y], i) => (
          <g key={i}>
            <line x1={x} y1="230" x2={x} y2={y} stroke={AMBER} strokeWidth="1.2" opacity="0.7" />
            <circle cx={x} cy={y} r="3" fill={AMBER} />
          </g>
        ))}
        <text x="60" y="30" fill={CUE}>signal analogique continu</text>
        <text x="300" y="30" fill={AMBER}>échantillons (période Tₑ = 1/fₑ)</text>
        <text x="60" y="252">pas de quantification (2ⁿ niveaux sur n bits) ⇢ lignes pointillées</text>
      </g>
    </svg>
  );
}

function CompressorCurve() {
  return (
    <svg viewBox="0 0 560 300" role="img" aria-label="Courbe de transfert d'un compresseur" className="w-full">
      <g fontFamily="var(--font-jetbrains-mono)" fontSize="11" fill={INK}>
        <line x1="80" y1="20" x2="80" y2="250" stroke={AXIS} />
        <line x1="80" y1="250" x2="520" y2="250" stroke={AXIS} />
        <text x="20" y="30">Sortie (dB)</text>
        <text x="440" y="275">Entrée (dB)</text>
        {/* 1:1 reference */}
        <line x1="80" y1="250" x2="490" y2="30" stroke={AXIS} strokeDasharray="5 4" />
        <text x="430" y="52" fill={INK}>1:1 (sans compression)</text>
        {/* compressed: 1:1 up to threshold (300,135) then 4:1 */}
        <path d="M 80 250 L 300 135 L 490 110" fill="none" stroke={AMBER} strokeWidth="2.4" />
        <circle cx="300" cy="135" r="4" fill={CLIP} />
        <line x1="300" y1="135" x2="300" y2="250" stroke={CLIP} strokeWidth="1" strokeDasharray="3 3" />
        <text x="268" y="268" fill={CLIP}>seuil</text>
        <text x="360" y="105" fill={AMBER}>pente 4:1 au-dessus du seuil</text>
        <text x="150" y="225" fill={INK}>1:1 sous le seuil</text>
        {/* gain reduction */}
        <path d="M 470 55 L 470 112" stroke={SIGNAL} strokeWidth="1.6" markerEnd="url(#arrg)" />
        <text x="352" y="70" fill={SIGNAL}>réduction de gain</text>
        <defs>
          <marker id="arrg" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
            <path d="M0,0 L6,0 L3,6 z" fill={SIGNAL} />
          </marker>
        </defs>
      </g>
    </svg>
  );
}

function SignalChain() {
  const blocks = [
    { x: 15, label: "Source", sub: "voix, instrument" },
    { x: 105, label: "Micro", sub: "transducteur" },
    { x: 195, label: "Préampli", sub: "gain +40/60 dB" },
    { x: 285, label: "Console", sub: "EQ · dyn · bus" },
    { x: 375, label: "Conv. A/N", sub: "48 kHz · 24 bits" },
    { x: 465, label: "Enreg. / Diff.", sub: "DAW · antenne" },
  ];
  return (
    <svg viewBox="0 0 560 140" role="img" aria-label="Chaîne du signal audio" className="w-full">
      <g fontFamily="var(--font-jetbrains-mono)" fontSize="10" fill={INK}>
        {blocks.map((b, i) => (
          <g key={b.label}>
            <rect x={b.x} y="35" width="80" height="52" rx="6" fill="var(--tn-raised)" stroke={AXIS} />
            <text x={b.x + 40} y="57" textAnchor="middle" fill="var(--tn-ink)" fontSize="11">{b.label}</text>
            <text x={b.x + 40} y="74" textAnchor="middle" fill={INK} fontSize="8.5">{b.sub}</text>
            {i < blocks.length - 1 && (
              <path d={`M ${b.x + 80} 61 L ${b.x + 90} 61`} stroke={AMBER} strokeWidth="2" markerEnd="url(#arrc)" />
            )}
          </g>
        ))}
        <text x="15" y="120" fill={INK}>niveau micro (−50 dBu) → niveau ligne (+4 dBu) : la structure de gain se joue au préampli</text>
        <defs>
          <marker id="arrc" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill={AMBER} />
          </marker>
        </defs>
      </g>
    </svg>
  );
}

const FIGURES: Record<string, () => JSX.Element> = {
  "fletcher-munson": FletcherMunson,
  "balanced-line": BalancedLine,
  "mic-directivity": MicDirectivity,
  "sampling-quantization": SamplingQuantization,
  "compressor-curve": CompressorCurve,
  "signal-chain": SignalChain,
};

export function Figure({ figureId, caption }: { figureId: string; caption: string }) {
  const Component = FIGURES[figureId];
  if (!Component) return null;
  return (
    <figure className="my-6 rounded-md border border-line bg-surface p-4">
      <Component />
      <figcaption className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-ink-faint">
        {caption}
      </figcaption>
    </figure>
  );
}
