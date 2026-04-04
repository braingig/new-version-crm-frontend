/** Shape returned by work schedule / team schedule queries (same hours every working day). */
export type WorkScheduleLike = {
    weekendDays: number[];
    intervals: { startMinutes: number; endMinutes: number }[];
};

/** @deprecated Use WorkScheduleLike */
export type WeeklyPlanLike = WorkScheduleLike;

export function isoDayFromLocal(date: Date): number {
    const js = date.getDay();
    return js === 0 ? 7 : js;
}

/**
 * True when `now` falls inside any interval for today, and today is not a weekend day.
 * Intervals apply identically to every non-weekend day.
 */
export function isScheduleActiveNow(schedule: WorkScheduleLike, now: Date): boolean {
    const iso = isoDayFromLocal(now);
    if ((schedule.weekendDays ?? []).includes(iso)) return false;
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const intervals = schedule.intervals ?? [];
    if (intervals.length === 0) return false;
    return intervals.some(
        (s) => nowMinutes >= s.startMinutes && nowMinutes < s.endMinutes,
    );
}

/** @deprecated Use isScheduleActiveNow */
export const isPlanActiveNow = isScheduleActiveNow;
