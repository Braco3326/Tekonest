declare global {
    interface ObjectConstructor {
        hasOwn(o: object, v: PropertyKey): boolean;
    }
    interface String {
        toWellFormed(): string;
    }
}
export interface PortRef {
    instance: string;
    port: string;
}
export interface Port {
    portId: string;
    dir: 'in' | 'out' | 'bidir';
    connector: string;
    signal?: string;
    flags?: string[];
}
export interface Instance {
    instanceId: string;
    deviceClass: string;
    ports: Port[];
    controls: Record<string, boolean | string>;
    levels: Record<string, number | '-inf'>;
    portState: Record<string, Record<string, number | boolean | string>>;
}
export interface Connection {
    a: PortRef;
    b: PortRef;
    cable?: {
        balanced?: boolean;
        lengthM?: number;
    };
}
export interface Setup {
    coveredFamilies: string[];
    instances: Instance[];
    connections: Connection[];
    groups?: unknown[];
    ctx?: Record<string, unknown>;
}
export type VerdictResult = "bon" | "a-corriger" | "indetermine";
export type VerdictReason = "setup-error" | "no-declaration" | "missing-input" | "no-coverage";
export interface Verdict {
    setupHash: string;
    coveredFamilies: string[];
    result: VerdictResult;
    labelFr: string;
    reason: VerdictReason | null;
    primary: {
        ruleId: string;
        subjects: PortRef[];
        causeFr: string;
        fixFr: string;
        factIds: string[];
    } | null;
    note: string | null;
    alsoFound: {
        ruleId: string;
        subjects: PortRef[];
    }[];
    notEvaluated: {
        ruleId: string;
        missing: string[];
    }[];
}
