/**
 * The console balance as a level factor per channel (Phase 4 final wave, brief §5: the console's mute, fader and PAN affect the sound). Pure: no import.
 * ONE law, read by the sound (src/creation/listenVoices.ts) and by the coverage (src/creation/coverageSources.ts), so the dots and what is heard agree.
 *
 *   G100  left only          L × 1,   R × 0
 *   G50   right at one half  L × 1,   R × 0.5   (−6 dB)
 *   C     centre             L × 1,   R × 1
 *   D50   left at one half   L × 0.5, R × 1
 *   D100  right only         L × 0,   R × 1
 *
 * (the catalog's `balance-master` enum; an in-between value G/D n is linear: the opposite side × (1 − n/100).) A speaker fed by the left channel only uses the L
 * factor, one fed by the right channel only the R factor, one fed by both the MEAN of the two. A simple linear law: a teaching model, not a console's pan law.
 */
export interface ChannelFactors {
  l: number
  r: number
}

const CENTRE: ChannelFactors = { l: 1, r: 1 }

/** The L / R factors of a `balance-master` value; anything unknown is the centre. */
export function balanceFactors(balance: string): ChannelFactors {
  const m = /^([GD])(\d{1,3})$/.exec(balance)
  if (!m) return { ...CENTRE }
  const away = 1 - Math.min(100, Number(m[2])) / 100 // the side the balance moves away from
  return m[1] === 'G' ? { l: 1, r: away } : { l: away, r: 1 }
}

/** The factor that applies to a speaker fed by these channels. */
export function speakerBalanceFactor(balance: string, channels: readonly ('L' | 'R')[]): number {
  const f = balanceFactors(balance)
  const hasL = channels.includes('L')
  const hasR = channels.includes('R')
  if (hasL && hasR) return (f.l + f.r) / 2
  return hasL ? f.l : hasR ? f.r : 1
}

/** The same in dB: 0 for the centre, −Infinity when the side is cut. */
export function speakerBalanceDb(balance: string, channels: readonly ('L' | 'R')[]): number {
  const f = speakerBalanceFactor(balance, channels)
  return f === 1 ? 0 : f <= 0 ? -Infinity : 20 * Math.log10(f)
}
