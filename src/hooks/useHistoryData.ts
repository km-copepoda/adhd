"use client";

import { useEffect, useState } from "react";
import { formatDate, type DaySummary } from "@/lib/heatmap";
import type { Category } from "@/types";

export type HistoryStatus = "APPROVED" | "SKIPPED" | "NO_ACTION";

export type HistoryItem = {
  id: string | null;
  status: HistoryStatus;
  date: string;
  approvedAt: string | null;
  comment: string | null;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  child: { id: string; name: string; monsterName: string | null; side: string | null } | null;
  template: { title: string; emoji: string; category: Category; photoBonus?: boolean };
};

export type MonthlySummary = {
  days: Record<string, DaySummary>;
  achievedDays: number;
  totalApproved: number;
  totalXp: number;
};

export type Child = { id: string; name: string; monsterName: string | null };

export type UseHistoryDataResult = {
  children: Child[];
  selectedChildId: string | null;
  setSelectedChildId: (id: string | null) => void;
  items: HistoryItem[];
  monthlySummary: MonthlySummary | null;
  loadingItems: boolean;
  loadingSummary: boolean;
  isFirstLoad: boolean;
};

export function useHistoryData(selectedDate: Date, viewMonth: Date): UseHistoryDataResult {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [firstLoad, setFirstLoad] = useState(true);

  useEffect(() => {
    fetch("/api/family/code")
      .then((res) => (res.ok ? res.json() : { members: [] }))
      .then((data) => {
        const kids: Child[] = (data.members ?? [])
          .filter((m: { role: string }) => m.role === "CHILD")
          .map((m: { id: string; name: string; monsterName: string | null }) => ({
            id: m.id,
            name: m.name,
            monsterName: m.monsterName,
          }));
        setChildren(kids);
        if (kids.length > 0) {
          setSelectedChildId(kids[0].id);
        } else {
          setLoadingSummary(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth() + 1;
    setLoadingSummary(true);
    setMonthlySummary(null);
    fetch(`/api/quests/monthly-summary?year=${year}&month=${month}&childId=${selectedChildId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setMonthlySummary(data))
      .finally(() => setLoadingSummary(false));
  }, [viewMonth, selectedChildId]);

  useEffect(() => {
    if (!selectedChildId) return;
    setLoadingItems(true);
    fetch(`/api/quests/history?date=${formatDate(selectedDate)}&childId=${selectedChildId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setItems(data))
      .finally(() => {
        setFirstLoad(false);
        setLoadingItems(false);
      });
  }, [selectedDate, selectedChildId]);

  return {
    children,
    selectedChildId,
    setSelectedChildId,
    items,
    monthlySummary,
    loadingItems,
    loadingSummary,
    isFirstLoad: firstLoad,
  };
}
