import type { FlowAction, FlowState, FlowStatus, Flow, HostEvent, Step } from "./types.ts";
export const FLOW_UNKNOWN = "flow-unknown";
export function initialFlowState(): FlowState {
    return { flowId: "", index: 0, status: "idle", startedAt: 0, completed: [] };
}
const STATUSES: readonly string[] = ["idle", "running", "done", "skipped"];
export function parseFlowState(raw: unknown, flows: Flow[]): FlowState {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
        return initialFlowState();
    const r = raw as Record<string, unknown>;
    const completed = Array.isArray(r.completed) ? [...new Set(r.completed.filter((x): x is string => typeof x === "string"))] : [];
    const startedAt = typeof r.startedAt === "number" && Number.isFinite(r.startedAt) ? r.startedAt : 0;
    const idle: FlowState = { ...initialFlowState(), completed };
    if (typeof r.status !== "string" || !STATUSES.includes(r.status) || r.status === "idle")
        return idle;
    if (typeof r.flowId !== "string")
        return idle;
    const flow = flows.find((f) => f.id === r.flowId);
    if (flow === undefined || flow.steps.length === 0)
        return idle;
    const status = r.status as FlowStatus;
    const index = r.index;
    if (typeof index !== "number" || !Number.isInteger(index))
        return idle;
    if (status === "running" && (index < 0 || index >= flow.steps.length))
        return idle;
    if ((status === "done" || status === "skipped") && index !== flow.steps.length)
        return idle;
    return { flowId: flow.id, index, status, startedAt, completed };
}
export function flowError(state: FlowState | null, action: FlowAction, flows: Flow[]): string | null {
    if (action.type === "start") {
        const f = flows.find((x) => x.id === action.flowId);
        return f === undefined || f.steps.length === 0 ? FLOW_UNKNOWN : null;
    }
    if (action.type === "restart") {
        const f = state === null ? undefined : flows.find((x) => x.id === state.flowId);
        return f === undefined || f.steps.length === 0 ? FLOW_UNKNOWN : null;
    }
    return null;
}
function isPlainValue(v: unknown): v is string | number | boolean {
    return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}
function dataMatches(match: Record<string, string | number | boolean>, data: HostEvent["data"]): boolean {
    if (data === undefined || data === null || typeof data !== "object")
        return false;
    for (const [key, want] of Object.entries(match)) {
        if (!Object.hasOwn(data, key))
            return false;
        const got = (data as Record<string, unknown>)[key];
        if (!isPlainValue(got) || got !== want)
            return false;
    }
    return true;
}
export function matchesDone(step: Step, evt: HostEvent): boolean {
    const done = step?.done;
    if (done === undefined || done === null || typeof done.event !== "string")
        return false;
    if (evt === undefined || evt === null || evt.type !== done.event)
        return false;
    const match = done.match;
    if (match === undefined || match === null || Object.keys(match).length === 0)
        return true;
    if (dataMatches(match, evt.data))
        return true;
    if (evt.type === "connect" && Object.hasOwn(match, "a") && Object.hasOwn(match, "b")) {
        const d = evt.data;
        if (d === undefined || d === null || typeof d !== "object")
            return false;
        if (!Object.hasOwn(d, "a") || !Object.hasOwn(d, "b"))
            return false;
        return dataMatches(match, { ...d, a: d.b, b: d.a });
    }
    return false;
}
function findFlow(flows: Flow[], id: string): Flow | undefined {
    return flows.find((f) => f.id === id);
}
export function currentStep(state: FlowState, flows: Flow[]): Step | null {
    if (state.status !== "running")
        return null;
    const flow = findFlow(flows, state.flowId);
    if (flow === undefined)
        return null;
    return flow.steps[state.index] ?? null;
}
function without(list: string[], id: string): string[] {
    return list.filter((x) => x !== id);
}
function finish(state: FlowState, flow: Flow, status: "done" | "skipped"): FlowState {
    const completed = status === "done" && !state.completed.includes(flow.id) ? [...state.completed, flow.id] : [...state.completed];
    return { ...state, status, index: flow.steps.length, completed };
}
function reduceCore(state: FlowState, action: FlowAction, flows: Flow[]): FlowState {
    switch (action.type) {
        case "start": {
            const flow = findFlow(flows, action.flowId);
            if (flow === undefined || flow.steps.length === 0)
                return state;
            return {
                flowId: flow.id,
                index: 0,
                status: "running",
                startedAt: action.at,
                completed: without(state.completed, flow.id),
            };
        }
        case "event": {
            const flow = findFlow(flows, state.flowId);
            if (state.status !== "running" || flow === undefined)
                return state;
            const step = flow.steps[state.index];
            if (step === undefined || !matchesDone(step, action.event))
                return state;
            if (state.index + 1 >= flow.steps.length)
                return finish(state, flow, "done");
            return { ...state, index: state.index + 1, completed: [...state.completed] };
        }
        case "back": {
            const flow = findFlow(flows, state.flowId);
            if (flow === undefined)
                return state;
            if (state.status === "running") {
                if (state.index <= 0 || state.index >= flow.steps.length)
                    return state;
                return { ...state, index: state.index - 1, completed: [...state.completed] };
            }
            if (state.status === "done" || state.status === "skipped") {
                return { ...state, status: "running", index: flow.steps.length - 1, completed: without(state.completed, flow.id) };
            }
            return state;
        }
        case "skip": {
            const flow = findFlow(flows, state.flowId);
            if (state.status !== "running" || flow === undefined)
                return state;
            if (state.index < 0 || state.index >= flow.steps.length)
                return state;
            if (state.index + 1 >= flow.steps.length)
                return finish(state, flow, "skipped");
            return { ...state, index: state.index + 1, completed: [...state.completed] };
        }
        case "restart": {
            const flow = findFlow(flows, state.flowId);
            if (flow === undefined || flow.steps.length === 0)
                return state;
            return { flowId: flow.id, index: 0, status: "running", startedAt: action.at, completed: without(state.completed, flow.id) };
        }
        case "stop":
            return { flowId: "", index: 0, status: "idle", startedAt: 0, completed: [...state.completed] };
        default:
            return state;
    }
}
export function reduceFlow(state: FlowState, action: FlowAction, flows: Flow[]): FlowState {
    const safe = Array.isArray(state.completed) ? state : { ...state, completed: [] };
    return reduceCore(safe, action, flows);
}
export function reduceFlowChecked(state: FlowState, action: FlowAction, flows: Flow[]): {
    state: FlowState;
    error: string | null;
} {
    const error = flowError(state, action, flows);
    return { state: error === null ? reduceFlow(state, action, flows) : state, error };
}
