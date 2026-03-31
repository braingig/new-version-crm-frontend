import { addDays } from 'date-fns';

/** Minimal plan shape for “within scheduled hours right now” checks (matches team schedule query). */
export type WeeklyPlanLike = {
    weekStart: string;
    weekendDays: number[];
    slots: { dayOfWeek: number; startMinutes: number; endMinutes: number }[];
};

export function toDateOnlyISOStringFromLocal(localMidnight: Date): string {
    return new Date(
        Date.UTC(
            localMidnight.getFullYear(),
            localMidnight.getMonth(),
            localMidnight.getDate(),
        ),
    ).toISOString();
}

function startOfLocalDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function nextIsoDay(iso: number): number {
    return iso === 7 ? 1 : iso + 1;
}

/** First working day after the weekend block (ISO weekday 1–7). */
export function computeWorkWeekStartDay(weekendDays: number[]): number {
    const isWeekend: boolean[] = Array.from({ length: 8 }, () => false);
    for (const d of weekendDays) isWeekend[d] = true;

    const boundaries: number[] = [];
    for (let dayIso = 1; dayIso <= 7; dayIso++) {
        const isBoundaryEnd = isWeekend[dayIso] && !isWeekend[nextIsoDay(dayIso)];
        if (isBoundaryEnd) boundaries.push(dayIso);
    }

    if (boundaries.length !== 1) {
        throw new Error(
            'weekendDays must form one consecutive block (e.g. Fri or Fri-Sat or Sat-Sun).',
        );
    }
    const endWeekendDay = boundaries[0];
    return nextIsoDay(endWeekendDay);
}

/**
 * True when `now` (local clock) falls inside any slot for today’s calendar day,
 * for the plan week that covers today — same rules as the team schedule “Active” filter.
 */
export function isPlanActiveNow(plan: WeeklyPlanLike, now: Date): boolean {
    const planWeekStart = new Date(plan.weekStart);
    const planWeekStartLocal = new Date(
        planWeekStart.getUTCFullYear(),
        planWeekStart.getUTCMonth(),
        planWeekStart.getUTCDate(),
    );
    const todayStart = startOfLocalDay(now);
    const weekEnd = addDays(planWeekStartLocal, 6);
    if (todayStart < planWeekStartLocal || todayStart > weekEnd) return false;

    const idx = Math.round(
        (todayStart.getTime() - planWeekStartLocal.getTime()) / (24 * 60 * 60 * 1000),
    );
    if (idx < 0 || idx > 6) return false;

    let startDay = 1;
    try {
        startDay = computeWorkWeekStartDay(plan.weekendDays ?? []);
    } catch {
        startDay = 1;
    }
    const dayOrder = Array.from({ length: 7 }, (_, i) => ((startDay - 1 + i) % 7) + 1);
    const iso = dayOrder[idx];
    if ((plan.weekendDays ?? []).includes(iso)) return false;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const daySlots = (plan.slots ?? []).filter((s) => s.dayOfWeek === iso);
    if (daySlots.length === 0) return false;

    return daySlots.some(
        (s) => nowMinutes >= s.startMinutes && nowMinutes < s.endMinutes,
    );
}
