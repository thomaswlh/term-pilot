export const theme = {
  ground: "#EFF2F5",
  sheet: "#FFFFFF",
  ink: "#161B20",
  muted: "#596573",
  line: "#DCE2E6",
  field: "#E8EEF2",
  accent: "#1B5E6B",
  accentHover: "#134650",
  accentLight: "#E0EFF2",
  accentInk: "#0E363D",
  focus: "#1B5E6B",
  rose: "#B3261E",
  selection: "#CFE3E7",
  hues: {
    green: { background: "#D8EDE1", edge: "#235E38", text: "#144425" },
    amber: { background: "#F4EBD4", edge: "#7E5A18", text: "#543A0C" },
    teal: { background: "#D5ECEB", edge: "#1C6360", text: "#114240" },
    blue: { background: "#D8E5F3", edge: "#234E7B", text: "#153456" },
  },
} as const;

export type HueName = keyof typeof theme.hues;
