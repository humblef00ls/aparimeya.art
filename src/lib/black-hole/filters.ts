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
export type FilterPreset = keyof typeof FILTERS;
