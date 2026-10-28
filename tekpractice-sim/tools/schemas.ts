/**
 * schemas — single source of zod truth for content/*.json.
 * Used by validate-catalog.ts (runtime validation) and
 * generate-schema.ts (editor JSON-schema generation).
 * The engine's CatalogLoader (src/engine) will import these too — do not fork them.
 */
import { z } from 'zod'

export const PortFlag = z.enum([
  'providesPhantom', 'requiresPhantom', 'isClockMaster', 'isClockSlave',
  'isMicInput', 'isMonitorOut', 'isOnAirTally', 'isDantePrimary', 'isMainsSource',
]).describe(
  'A behaviour flag on a port that logic/* reads. isMainsSource (C7, Task 32): an output that really supplies mains; a mains-power output without it (a Bêta proposal) powers nothing.',
)

export const Port = z.object({
  portId: z.string().min(1),
  dir: z.enum(['in', 'out', 'bidir']),
  connector: z.string().min(1),
  signal: z.string().min(1),
  flags: z.array(PortFlag).optional(),
})

/**
 * A physical switch/knob on the device (ADR-0001 toggles, ADR-0007 enums).
 * Discriminated on `type`:
 *  - toggle: boolean `default`; optional `enables` gates a port flag on the
 *    runtime value (ISA One "+48V" gates providesPhantom on in-mic).
 *  - enum: a picker (e.g. sample-rate) — `options` (≥2) with `defaultOption`.
 *    Read directly by logic/* (no flag gating). validate-catalog asserts
 *    defaultOption ∈ options.
 */
export const ToggleControl = z.object({
  id: z.string().min(1),
  type: z.literal('toggle'),
  label: z.string().min(1),
  default: z.boolean(),
  enables: z.object({
    flag: PortFlag,
    ports: z.array(z.string().min(1)).min(1),
  }).optional(),
})
export const EnumControl = z.object({
  id: z.string().min(1),
  type: z.literal('enum'),
  label: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  defaultOption: z.string().min(1),
})
export const Control = z.discriminatedUnion('type', [ToggleControl, EnumControl])

/**
 * One signal route of a device (council C8, P7): where the signal that enters the device goes, as data.
 * Read only by the pure signal-path module (Task 34); the engine never reads it and R1-R3 do not depend on it.
 * tools/catalogChecks.ts checks a route against the ports and controls of its device (the zod shape cannot see them).
 */
export const Route = z.object({
  from: z.string().min(1).describe(
    'Where the signal enters: an input (or bidir) port id of this device, or "control:<controlId>" for a source inside the device (e.g. "control:playback-usb").',
  ),
  to: z.array(z.string().min(1)).min(1).describe(
    'Where it leaves: output (or bidir) port ids of this device, or the pseudo-target "transducer" (the device is a loudspeaker and this route feeds its drivers).',
  ),
  channels: z.array(z.enum(['L', 'R'])).optional().describe(
    'Stereo channel carried to each target, parallel to `to` (same length, P7): ["L","R"] sends left to the first output and right to the second.',
  ),
  passive: z.boolean().optional().describe(
    'True for a parallel link that works with the device unpowered (P7): a loop-thru / link out the knowledge base documents. Absent = the route needs the device powered.',
  ),
  when: z.object({
    control: z.string().min(1).describe('Id of a control of this device.'),
    equals: z.union([z.boolean(), z.string()]).describe('Value that control must have for the route to be live: a boolean for a toggle, one of the options for an enum.'),
  }).optional().describe('The route is live only while this control has this value (e.g. playback-usb on). Absent = always live.'),
}).refine((r) => r.channels === undefined || r.channels.length === r.to.length, {
  path: ['channels'],
  message: '`channels` must have exactly one entry per `to` target',
})

export const Device = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'device id must be a kebab-case slug'),
  label: z.string().min(1),
  levels: z.array(z.string()),
  realWorld: z.object({
    brand: z.string().min(1),
    model: z.string().min(1),
    category: z.string().min(1),
    typicalUse: z.string().min(1),
    notes: z.string(),
  }),
  ports: z.array(Port),
  controls: z.array(Control).optional(),
  routing: z.array(Route).optional().describe(
    'Signal routes of the device (C8): consumed by the signal path only. Verified data: a Bêta proposal never carries routing (parseProposals drops it).',
  ),
})

export const Rule = z.object({
  id: z.string().regex(/^R[1-8]$/),
  slug: z.string().min(1),
  module: z.enum(['engine', 'logic/phantom', 'logic/gpio', 'logic/mixMinus', 'logic/clock']),
  severity: z.enum(['error', 'warning']),
  title: z.string().min(1),
  check: z.string().min(1),
  teach: z.string().min(1),
  /** The French fields are the only rule text Mode Création shows (C17); `title` / `teach` stay English for the legacy UI. */
  title_fr: z.string().min(1).describe('French title of the rule, shown at the refused port, in the error list and in the Connecter à… dialog (Mode Création).'),
  teach_fr: z.string().min(1).describe('French teaching text of the rule, shown as the detail line in the error list and under the reason in the Connecter à… dialog (Mode Création).'),
})

export const Catalog = z.object({
  version: z.number(),
  meta: z.object({}).passthrough(),
  connectorTypes: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    gender: z.enum(['male', 'female', 'universal']),
    matesWith: z.array(z.string()).min(1),
  })),
  signalTypes: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    class: z.enum(['analog', 'digital', 'control', 'power']),
  })),
  devices: z.array(Device),
  rules: z.array(Rule),
}).passthrough()

export const PortRef = z.object({ instance: z.string().min(1), port: z.string().min(1) })

export const Level = z.object({
  id: z.string().min(1),
  version: z.number(),
  domain: z.enum(['live', 'radio', 'duplex', 'post']),
  title: z.string().min(1),
  brief: z.string().min(1),
  devices: z.array(z.object({ instanceId: z.string().min(1), deviceId: z.string().min(1) })),
  requiredChain: z.array(z.object({ from: PortRef, to: PortRef })),
  logicChecks: z.array(z.string()),
  successMessage: z.string().min(1),
  /** Time budget for exam mode (Beat 5); default applied by the game when absent. */
  examSeconds: z.number().positive().optional(),
  /** Scene preset id (content/environments/<id>.json). */
  environment: z.string().min(1).optional(),
  /** Stage positions per instanceId, meters [x, y, z]. Missing instances fall back to a grid. */
  layout: z.record(z.tuple([z.number(), z.number(), z.number()])).optional(),
  /**
   * Essais (ADR-0012 D2, Task 14): the level offers the Essais panel. The
   * sandbox always does; levels and exams only when this is true.
   */
  essais: z.boolean().optional(),
}).passthrough()

/** Scene preset — a backdrop + camera, NEVER engine code (VISION §3: environments are data). */
export const Environment = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  backdrop: z.object({
    clearColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    floorColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    floorSize: z.tuple([z.number().positive(), z.number().positive()]),
  }),
  /**
   * Optional realistic ROOM backdrop (sourcing run, Set-System): a glb in
   * public/assets/environments/ anchored AROUND the origin where the gear
   * lives. Loads non-blocking; failure keeps the white studio (never breaks).
   * NB: the spec sketch named this field `backdrop: "<glb>"` — backdrop was
   * already the colors object, so the room lives under `set` (logged).
   */
  set: z.object({
    glb: z.string().min(1),
    position: z.tuple([z.number(), z.number(), z.number()]).optional(),
    rotationY: z.number().optional(),
    scale: z.number().positive().optional(),
  }).optional(),
  camera: z.object({
    alpha: z.number(),
    beta: z.number(),
    radius: z.number().positive(),
    target: z.tuple([z.number(), z.number(), z.number()]),
  }),
}).passthrough()

/** Referential mapping rules → BC/épreuves (content/readiness.json, ADR-0003). */
export const Readiness = z.object({
  version: z.number(),
  competencies: z.record(z.object({ label: z.string().min(1), inGame: z.boolean() })),
  epreuves: z.record(z.object({ label: z.string().min(1), coefficient: z.number().positive() })),
  rules: z.record(
    z.object({
      bc: z.array(z.string().min(1)).min(1),
      epreuves: z.array(z.string().min(1)).min(1),
      tip: z.string().min(1),
    }),
  ),
}).passthrough()

/** Coach tips (content/coach/tips.json) — the mentor voice, contextual triggers. */
export const Coach = z.object({
  version: z.number(),
  tips: z.array(
    z.object({
      id: z.string().min(1),
      trigger: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('rule'), ruleId: z.string().regex(/^R[1-8]$/) }),
        z.object({ kind: z.literal('low-moment') }),
        z.object({ kind: z.literal('comeback') }),
        z.object({ kind: z.literal('forgiveness') }),
        z.object({ kind: z.literal('exam-low') }),
        z.object({ kind: z.literal('first-win') }),
      ]),
      text: z.string().min(1),
    }),
  ),
}).passthrough()

/** Onboarding questionnaire (content/onboarding.json, Beat 1). */
export const Onboarding = z.object({
  version: z.number(),
  intro: z.string().min(1),
  examDateLabel: z.string().min(1),
  questions: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      options: z.array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          rules: z.array(z.string().regex(/^R[1-8]$/)),
        }),
      ).min(2),
    }),
  ).min(1),
  cta: z.string().min(1),
}).passthrough()

export type CatalogT = z.infer<typeof Catalog>
export type LevelT = z.infer<typeof Level>
export type ReadinessT = z.infer<typeof Readiness>
export type EnvironmentT = z.infer<typeof Environment>
export type CoachT = z.infer<typeof Coach>
export type OnboardingT = z.infer<typeof Onboarding>
