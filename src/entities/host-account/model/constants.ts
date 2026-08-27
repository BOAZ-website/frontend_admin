import type { HostAccount } from "./types";

export const INITIAL_HOSTS: HostAccount[] = [
  {
    id: "h1",
    username: "host_a",
    initialPassword: "boaz2026!a",
    hostName: "이민준 (A팀장)",
    team: "A팀",
    createdAt: "2025-02-28",
    active: true,
    lastLogin: "2025-03-18 19:30",
  },
  {
    id: "h2",
    username: "host_b",
    initialPassword: "boaz2026!b",
    hostName: "강태양 (B팀장)",
    team: "B팀",
    createdAt: "2025-02-28",
    active: true,
    lastLogin: "2025-03-18 18:45",
  },
  {
    id: "h3",
    username: "host_c",
    initialPassword: "boaz2026!c",
    hostName: "문지훈 (C팀장)",
    team: "C팀",
    createdAt: "2025-02-28",
    active: true,
    lastLogin: "2025-03-11 20:40",
  },
  {
    id: "h4",
    username: "host_d",
    initialPassword: "boaz2026!d",
    hostName: "고준서 (D팀장)",
    team: "D팀",
    createdAt: "2025-02-28",
    active: true,
    lastLogin: "2025-03-18 20:12",
  },
];
