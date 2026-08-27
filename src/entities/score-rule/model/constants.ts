import type { ScoreRule } from "./types";

export const INITIAL_RULES: ScoreRule[] = [
  {
    version: 3,
    status: "ACTIVE",
    activatedAt: "2025-03-01",
    createdBy: "차기대표진",
    present: 1,
    late: 0.5,
    absent: 0,
  },
  {
    version: 2,
    status: "INACTIVE",
    activatedAt: "2025-01-15",
    createdBy: "차기대표진",
    present: 1,
    late: 0.5,
    absent: 0,
  },
  {
    version: 1,
    status: "INACTIVE",
    activatedAt: "2024-09-01",
    createdBy: "차기대표진",
    present: 1,
    late: 0,
    absent: 0,
  },
];
