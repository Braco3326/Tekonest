import type { Setup } from "../hostTypes.ts";
export type { Setup };
export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface Point {
    x: number;
    y: number;
}
export type StepAction = "point" | "click" | "drag" | "toggle" | "type" | "read" | "wait";
export interface DoneWhen {
    event: string;
    match?: Record<string, string | number | boolean>;
}
export interface Step {
    id: string;
    anchor: string;
    action: StepAction;
    to?: string;
    say: string;
    done: DoneWhen;
    hintAfterMs?: number;
}
export interface ContextPredicate {
    page?: GuideContext["page"];
    mode?: GuideContext["mode"];
}
export interface Flow {
    id: string;
    titleKey: string;
    when?: ContextPredicate;
    steps: Step[];
}
export type FlowStatus = "idle" | "running" | "done" | "skipped";
export interface FlowState {
    flowId: string;
    index: number;
    status: FlowStatus;
    startedAt: number;
    completed: string[];
}
export type FlowAction = {
    type: "start";
    flowId: string;
    at: number;
} | {
    type: "event";
    event: HostEvent;
} | {
    type: "back";
} | {
    type: "skip";
} | {
    type: "restart";
    at: number;
} | {
    type: "stop";
};
export interface HostEvent {
    type: string;
    at: number;
    data?: Record<string, string | number | boolean>;
}
export type CourseLocationKind = "lesson" | "quiz" | "survey" | "exam" | "dashboard";
export interface CourseLesson {
    id: string;
    title: string;
    topics: string[];
}
export interface CourseUnit {
    id: string;
    title: string;
    lessons: CourseLesson[];
    quiz: {
        id: string;
        graded: boolean;
    } | null;
}
export interface CourseLocation {
    kind: CourseLocationKind;
    unitId?: string;
    lessonId?: string;
}
export interface CourseContext {
    courseId: string;
    units: CourseUnit[];
    done: string[];
    location: CourseLocation;
    examUnlocked: boolean;
}
export interface GuideContext {
    page: "workbench" | "course" | "other";
    mode: "practice" | "exam";
    setup?: Setup;
    course?: CourseContext;
    now: number;
}
export type NextStepKind = "flow-step" | "fix" | "need-info" | "good" | "course" | "locked" | "none";
export interface NextStep {
    kind: NextStepKind;
    step?: Step;
    anchor?: string;
    textKey?: string;
    text?: string;
    flowId?: string;
}
export type MascotState = "idle" | "walk" | "point" | "think" | "celebrate" | "no" | "sleep";
export type Gesture = "point" | "click" | "drag" | "toggle" | "read";
export type ChipId = "next" | "show" | "hint" | "where" | "mute" | "close" | "open" | "start" | "skip";
export interface Chip {
    id: ChipId;
    label: string;
}
export interface BubbleLine {
    text: string;
    badge: string | null;
    citation: string | null;
}
export type BubbleKind = "step" | "fix" | "need-info" | "good" | "answer" | "course" | "locked" | "refusal" | "withheld" | "celebrate" | "info";
export interface Bubble {
    kind: BubbleKind;
    title?: string;
    lines: BubbleLine[];
    chips: Chip[];
}
export interface ViewTarget {
    anchor: string;
    rect: Rect | null;
    gesture: Gesture;
    from?: Rect | null;
    to?: Rect | null;
}
export interface GuideView {
    visible: boolean;
    muted: boolean;
    bubble: Bubble | null;
    target: ViewTarget | null;
    mascot: MascotState;
    busy: boolean;
    error: string | null;
    wantAnchors: string[];
}
export interface Keyframe {
    t: number;
    x: number;
    y: number;
    state: MascotState;
}
export interface MotionPlan {
    ok: boolean;
    reason?: "unresolved";
    keyframes: Keyframe[];
    ring: Rect | null;
    cable: Point[] | null;
    needsScroll: boolean;
    durationMs: number;
}
export type FlowControl = {
    action: "start";
    flowId: string;
} | {
    action: "back" | "skip" | "restart" | "stop";
};
export type ControllerInput = {
    type: "hostEvent";
    event: HostEvent;
} | {
    type: "ask";
    text: string;
} | {
    type: "chip";
    id: ChipId;
} | {
    type: "setContext";
    context: {
        page?: unknown;
        mode?: unknown;
        setup?: unknown;
        course?: unknown;
    };
} | {
    type: "anchorRects";
    rects: Record<string, Rect | null>;
} | {
    type: "arrived";
} | {
    type: "typing";
    typing: boolean;
} | {
    type: "flow";
    control: FlowControl;
} | {
    type: "tick";
};
