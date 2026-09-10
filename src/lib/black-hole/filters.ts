/** Display-space gradient stops, ordered from shadows to highlights. */
export const FILTERS = {
  none: {
    label: "None",
    description: "Original colors",
    colors: ["#000000", "#808080", "#ffffff"],
  },
  mono: {
    label: "Mono",
    description: "Black to silver to white",
    colors: ["#000000", "#808080", "#ffffff"],
  },
  amber: {
    label: "Amber",
    description: "Burnt orange to warm ivory",
    colors: ["#000000", "#b45316", "#fff0c2"],
  },
  aurora: {
    label: "Aurora",
    description: "Deep teal to mint light",
    colors: ["#000000", "#087d82", "#caffde"],
  },
  cosmic: {
    label: "Cosmic",
    description: "Violet to pink to pale gold",
    colors: ["#000000", "#923caf", "#ffe6b2"],
  },
} as const;
export type FilterPreset = keyof typeof FILTERS | "custom";
export interface GradientStop {
  position: number;
  color: string;
}
export const MAX_GRADIENT_STOPS = 16;
export const DEFAULT_GRADIENT: readonly GradientStop[] = [
  { position: 0, color: "#000000" },
  { position: 0.5, color: "#923caf" },
  { position: 1, color: "#ffe6b2" },
];
export const GRADIENT_STORAGE_KEY = "aparimeya.custom-gradient.v1";

/** Stored data is untrusted. Reject malformed or ambiguous gradients as a whole. */
export function parseGradient(raw: string | null): GradientStop[] | null {
  try {
    const stops: unknown = JSON.parse(raw ?? "null");
    if (
      !Array.isArray(stops) ||
      stops.length < 2 ||
      stops.length > MAX_GRADIENT_STOPS
    )
      return null;
    if (
      !stops.every(
        (stop) =>
          stop &&
          typeof stop.position === "number" &&
          Number.isFinite(stop.position) &&
          stop.position >= 0 &&
          stop.position <= 1 &&
          typeof stop.color === "string" &&
          /^#[0-9a-f]{6}$/i.test(stop.color),
      )
    )
      return null;
    const sorted = stops
      .map(({ position, color }) => ({ position, color }))
      .sort((a, b) => a.position - b.position);
    if (
      sorted.some((stop, i) => i > 0 && stop.position <= sorted[i - 1].position)
    )
      return null;
    return sorted;
  } catch {
    return null;
  }
}

export function gradientStops(
  preset: FilterPreset,
  custom: readonly GradientStop[],
): readonly GradientStop[] {
  return preset === "custom"
    ? custom
    : FILTERS[preset].colors.map((color, i) => ({ color, position: i / 2 }));
}
