import { strings } from "../content/strings.fr.ts";
export type Labels = {
    -readonly [K in keyof typeof strings.widget]: string;
};
export const labels: Labels = Object.freeze({ ...strings.widget });
