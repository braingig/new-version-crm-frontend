'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import type { DocumentNode } from '@apollo/client';
import { useQuery, useMutation } from '@apollo/client';
import {
    GET_WORK_SCHEDULE,
    SET_MY_WORK_SCHEDULE,
    SET_USER_WORK_SCHEDULE,
    GET_TEAM_WORK_SCHEDULES,
} from '@/lib/graphql/queries';
import { useToast } from '@/components/ToastProvider';
import {
    CalendarDaysIcon,
    ClockIcon,
    Squares2X2Icon,
    PlusIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';

const ISO_DAYS: { iso: number; short: string }[] = [
    { iso: 1, short: 'Mon' },
    { iso: 2, short: 'Tue' },
    { iso: 3, short: 'Wed' },
    { iso: 4, short: 'Thu' },
    { iso: 5, short: 'Fri' },
    { iso: 6, short: 'Sat' },
    { iso: 7, short: 'Sun' },
];

function minutesToTimeValue(m: number): string {
    const h = Math.floor(m / 60);
    const mi = m % 60;
    return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

function timeValueToMinutes(s: string): number {
    const [h, m] = s.split(':').map((x) => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    return Math.min(1439, Math.max(0, h * 60 + m));
}

function prevIsoDay(iso: number): number {
    return iso === 1 ? 7 : iso - 1;
}

/** Same rule as backend: one contiguous weekend arc on the week (includes Fri–Sat–Sun, Sat–Sun–Mon). */
function validateWeekendDays(weekendDays: number[]): string | null {
    if (!weekendDays.length) return 'Choose at least one weekend day.';
    const set = new Set(weekendDays);
    if (set.size !== weekendDays.length) return 'Duplicate days are not allowed.';
    if (weekendDays.length >= 7) {
        return 'Leave at least one weekday — weekend cannot be all 7 days.';
    }
    const isWeekend = Array.from({ length: 8 }, () => false);
    for (const d of weekendDays) {
        if (d < 1 || d > 7) return 'Invalid day.';
        isWeekend[d] = true;
    }
    let weekendStarts = 0;
    for (let i = 1; i <= 7; i++) {
        const prev = prevIsoDay(i);
        if (!isWeekend[prev] && isWeekend[i]) weekendStarts += 1;
    }
    if (weekendStarts !== 1) {
        return 'Weekend must be one uninterrupted run (e.g. Fri; Fri–Sat; Fri–Sat–Sun; Sat–Sun; Sun). You cannot skip a day (e.g. Fri and Sun without Sat).';
    }
    return null;
}

type DraftInterval = {
    key: string;
    startMinutes: number;
    endMinutes: number;
};

function newIntervalKey(): string {
    return `iv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortWeekendDays(days: number[]): number[] {
    return [...days].sort((a, b) => a - b);
}

function normalizeIsoDays(days: number[] | null | undefined): number[] {
    if (!days?.length) return [];
    // Defensive normalization: accept either ISO (1..7) or JS (0..6) input.
    // - JS Sunday (0) -> ISO Sunday (7)
    // - Others keep their numeric value (Mon=1..Sat=6 are the same in both)
    const normalized = days.map((d) => (d === 0 ? 7 : d));
    return normalized.filter((d) => d >= 1 && d <= 7);
}

function weekendDaysEqual(a: number[], b: number[]): boolean {
    const sa = sortWeekendDays(a);
    const sb = sortWeekendDays(b);
    if (sa.length !== sb.length) return false;
    return sa.every((v, i) => v === sb[i]);
}

/** Compare interval lists; order does not matter (sorted by start). */
function intervalsEqual(
    a: { startMinutes: number; endMinutes: number }[],
    b: { startMinutes: number; endMinutes: number }[],
): boolean {
    if (a.length !== b.length) return false;
    const sa = [...a].sort((x, y) => x.startMinutes - y.startMinutes);
    const sb = [...b].sort((x, y) => x.startMinutes - y.startMinutes);
    return sa.every(
        (row, i) =>
            row.startMinutes === sb[i].startMinutes && row.endMinutes === sb[i].endMinutes,
    );
}

function isoDayFromDate(d: Date): number {
    const js = d.getDay(); // 0=Sun..6=Sat
    return js === 0 ? 7 : js;
}

function formatMinutesLabel(m: number): string {
    const h = Math.floor(m / 60);
    const mi = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    if (mi === 0) return `${h12} ${ap}`;
    return `${h12}:${String(mi).padStart(2, '0')} ${ap}`;
}

function clampMinute(m: number): number {
    return Math.min(1440, Math.max(0, m));
}

function mergeIntervals(
    intervals: { startMinutes: number; endMinutes: number }[],
): { startMinutes: number; endMinutes: number }[] {
    const clean = intervals
        .map((i) => ({
            startMinutes: clampMinute(i.startMinutes),
            endMinutes: clampMinute(i.endMinutes),
        }))
        .filter((i) => i.endMinutes > i.startMinutes)
        .sort((a, b) => a.startMinutes - b.startMinutes);
    const out: { startMinutes: number; endMinutes: number }[] = [];
    for (const i of clean) {
        const last = out[out.length - 1];
        if (!last || i.startMinutes > last.endMinutes) {
            out.push({ ...i });
        } else {
            last.endMinutes = Math.max(last.endMinutes, i.endMinutes);
        }
    }
    return out;
}

function minutesToHoursLabel(totalMinutes: number): string {
    const h = Math.round((totalMinutes / 60) * 10) / 10;
    if (!Number.isFinite(h)) return '0h';
    return `${h}h`;
}

export interface WorkScheduleEditorProps {
    /** When set, edits that user’s schedule (managers only; mutation setUserWorkSchedule). */
    targetUserId?: string;
    targetName?: string;
    /**
     * When true (e.g. admin on work-schedule page), saving “your” schedule also refetches the
     * team table so your row updates without a full page reload.
     */
    refetchTeamAfterMineSave?: boolean;
    /** When false, hides the “Editing …” banner (e.g. modal already shows the person). Default true. */
    showTargetBanner?: boolean;
}

export default function WorkScheduleEditor({
    targetUserId,
    targetName,
    refetchTeamAfterMineSave = false,
    showTargetBanner = true,
}: WorkScheduleEditorProps) {
    const { showToast } = useToast();
    const isAdmin = Boolean(targetUserId);

    const { data, loading, refetch } = useQuery(GET_WORK_SCHEDULE, {
        variables: isAdmin ? { userId: targetUserId } : {},
        fetchPolicy: 'network-only',
    });

    const mineRefetchQueries = useMemo(() => {
        const q: { query: DocumentNode; variables?: Record<string, unknown> }[] = [
            { query: GET_WORK_SCHEDULE, variables: {} },
        ];
        if (!isAdmin && refetchTeamAfterMineSave) {
            q.push({ query: GET_TEAM_WORK_SCHEDULES });
        }
        return q;
    }, [isAdmin, refetchTeamAfterMineSave]);

    const [setMine, { loading: savingMine }] = useMutation(SET_MY_WORK_SCHEDULE, {
        refetchQueries: isAdmin ? [] : mineRefetchQueries,
    });
    const [setUser, { loading: savingUser }] = useMutation(SET_USER_WORK_SCHEDULE, {
        refetchQueries: [
            { query: GET_WORK_SCHEDULE, variables: { userId: targetUserId } },
            { query: GET_TEAM_WORK_SCHEDULES },
        ],
    });

    const schedule = data?.workSchedule;

    const [weekendDays, setWeekendDays] = useState<number[]>([5]);
    const [draftIntervals, setDraftIntervals] = useState<DraftInterval[]>([]);
    const [weekendError, setWeekendError] = useState<string | null>(null);
    /** False until local state has been synced from `schedule` (avoids a flash of “dirty” on load). */
    const [hydratedFromSchedule, setHydratedFromSchedule] = useState(false);

    const saving = savingMine || savingUser;

    useEffect(() => {
        setHydratedFromSchedule(false);
    }, [targetUserId]);

    useEffect(() => {
        if (!schedule) return;
        const incomingWeekend = normalizeIsoDays(schedule.weekendDays);
        const incomingIntervals = schedule.intervals ?? [];
        const weekendFromSchedule =
            incomingWeekend.length === 0
                ? [5]
                : incomingWeekend.length === 1 &&
                    incomingWeekend[0] === 7 &&
                    incomingIntervals.length === 0
                  ? [5]
                  : incomingWeekend;
        setWeekendDays(
            [...weekendFromSchedule].sort(
                (a, b) => a - b,
            ),
        );
        setDraftIntervals(
            (schedule.intervals ?? []).map(
                (s: { startMinutes: number; endMinutes: number }) => ({
                    key: newIntervalKey(),
                    startMinutes: s.startMinutes,
                    endMinutes: s.endMinutes,
                }),
            ),
        );
        setWeekendError(null);
        setHydratedFromSchedule(true);
    }, [schedule]);

    const toggleWeekend = useCallback((iso: number) => {
        setWeekendDays((prev) => {
            const has = prev.includes(iso);
            const next = has ? prev.filter((d) => d !== iso) : [...prev, iso].sort((a, b) => a - b);
            setWeekendError(validateWeekendDays(next));
            return next;
        });
    }, []);

    const addInterval = () => {
        setDraftIntervals((prev) => [
            ...prev,
            {
                key: newIntervalKey(),
                startMinutes: 9 * 60,
                endMinutes: 17 * 60,
            },
        ]);
    };

    const updateInterval = (key: string, patch: Partial<DraftInterval>) => {
        setDraftIntervals((prev) =>
            prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
        );
    };

    const removeInterval = (key: string) => {
        setDraftIntervals((prev) => prev.filter((s) => s.key !== key));
    };

    const weekendErr = useMemo(
        () => weekendError ?? validateWeekendDays(weekendDays),
        [weekendDays, weekendError],
    );

    const intervalDiagnostics = useMemo(() => {
        const sorted = [...draftIntervals].sort((a, b) => a.startMinutes - b.startMinutes);

        const hard: string[] = [];
        const soft: string[] = [];

        const invalid = sorted.filter((i) => i.endMinutes <= i.startMinutes);
        if (invalid.length) {
            hard.push('Each time block must end after it starts.');
        }

        const normalized = sorted
            .map((i) => ({
                startMinutes: clampMinute(i.startMinutes),
                endMinutes: clampMinute(i.endMinutes),
            }))
            .filter((i) => i.endMinutes > i.startMinutes)
            .sort((a, b) => a.startMinutes - b.startMinutes);

        for (let idx = 1; idx < normalized.length; idx++) {
            const prev = normalized[idx - 1];
            const cur = normalized[idx];
            if (cur.startMinutes < prev.endMinutes) {
                hard.push('Time blocks overlap. Adjust them so they do not intersect.');
                break;
            }
        }

        if (normalized.some((i) => i.endMinutes - i.startMinutes < 30)) {
            soft.push('Some blocks are shorter than 30 minutes.');
        }

        if (draftIntervals.length === 0) {
            soft.push('No working hours set — you will never appear active.');
        }

        const merged = mergeIntervals(normalized);
        const dailyMinutes = merged.reduce((sum, i) => sum + (i.endMinutes - i.startMinutes), 0);

        return {
            hard,
            soft,
            merged,
            dailyMinutes,
        };
    }, [draftIntervals]);

    const weeklySummary = useMemo(() => {
        const workingDays = Math.max(0, 7 - weekendDays.length);
        const weeklyMinutes = intervalDiagnostics.dailyMinutes * workingDays;
        const todayIso = isoDayFromDate(new Date());
        const isWeekendToday = weekendDays.includes(todayIso);

        const merged = intervalDiagnostics.merged;
        const nextWindowToday =
            !isWeekendToday && merged.length
                ? `${formatMinutesLabel(merged[0].startMinutes)} – ${formatMinutesLabel(merged[0].endMinutes)}`
                : null;

        return {
            workingDays,
            weeklyMinutes,
            weekendLabel: weekendDays.length
                ? weekendDays
                      .slice()
                      .sort((a, b) => a - b)
                      .map((d) => ISO_DAYS.find((x) => x.iso === d)?.short ?? String(d))
                      .join(', ')
                : '—',
            blocksCount: draftIntervals.length,
            nextWindowToday,
            isWeekendToday,
        };
    }, [weekendDays, draftIntervals.length, intervalDiagnostics.dailyMinutes, intervalDiagnostics.merged]);

    const isDirty = useMemo(() => {
        if (!schedule || !hydratedFromSchedule) return false;
        const savedWeekend = schedule.weekendDays?.length
            ? sortWeekendDays(schedule.weekendDays)
            : [5];
        if (!weekendDaysEqual(weekendDays, savedWeekend)) return true;

        const savedIntervals = (schedule.intervals ?? []).map(
            (s: { startMinutes: number; endMinutes: number }) => ({
                startMinutes: s.startMinutes,
                endMinutes: s.endMinutes,
            }),
        );
        const currentIntervals = draftIntervals.map((s) => ({
            startMinutes: s.startMinutes,
            endMinutes: s.endMinutes,
        }));
        return !intervalsEqual(currentIntervals, savedIntervals);
    }, [schedule, hydratedFromSchedule, weekendDays, draftIntervals]);

    const hardIssues = Boolean(weekendErr) || intervalDiagnostics.hard.length > 0;

    const canSave =
        hydratedFromSchedule && isDirty && !hardIssues && !saving;

    const handleSave = async () => {
        const wErr = validateWeekendDays(weekendDays);
        if (wErr) {
            setWeekendError(wErr);
            showToast({ variant: 'error', message: wErr });
            return;
        }
        if (intervalDiagnostics.hard.length) {
            showToast({ variant: 'error', message: intervalDiagnostics.hard[0] });
            return;
        }
        const input = {
            weekendDays,
            intervals: draftIntervals.map((s) => ({
                startMinutes: s.startMinutes,
                endMinutes: s.endMinutes,
            })),
        };
        try {
            if (isAdmin && targetUserId) {
                await setUser({ variables: { userId: targetUserId, input } });
            } else {
                await setMine({ variables: { input } });
            }
            await refetch();
            showToast({ variant: 'success', message: 'Work schedule saved.' });
        } catch (e: any) {
            showToast({
                variant: 'error',
                message: e?.message || 'Could not save schedule.',
            });
        }
    };

    if (loading && !schedule) {
        return (
            <div className="flex justify-center py-16">
                <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-primary-600 dark:border-gray-700 dark:border-t-primary-400"
                    aria-hidden
                />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {showTargetBanner && isAdmin && targetName && (
                <div className="rounded-xl border border-primary-200/60 bg-primary-50/40 px-4 py-3 text-sm text-primary-900 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-100">
                    Editing{' '}
                    <span className="font-medium text-primary-950 dark:text-white">
                        {targetName}
                    </span>
                    ’s schedule
                </div>
            )}

            <section className="rounded-2xl border border-gray-200/80 bg-white px-5 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
                            Weekly summary
                        </p>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                            Live preview based on your current draft
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {weeklySummary.nextWindowToday ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200/60 bg-primary-50/70 px-3 py-1 text-xs font-medium text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-200">
                                <ClockIcon className="h-3.5 w-3.5" />
                                Today: {weeklySummary.nextWindowToday}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                <ClockIcon className="h-3.5 w-3.5" />
                                {weeklySummary.isWeekendToday ? 'Today is weekend' : 'No blocks today'}
                            </span>
                        )}
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-gray-950/40">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Weekend
                            </p>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                <CalendarDaysIcon className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="mt-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                            {weeklySummary.weekendLabel}
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-gray-950/40">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Weekly availability
                            </p>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                <ClockIcon className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="mt-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                            {minutesToHoursLabel(weeklySummary.weeklyMinutes)}
                            <span className="ml-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                                / {weeklySummary.workingDays} days
                            </span>
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-gray-950/40">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                Blocks
                            </p>
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                                <Squares2X2Icon className="h-4 w-4" />
                            </span>
                        </div>
                        <p className="mt-2 text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                            {weeklySummary.blocksCount}
                        </p>
                    </div>
                </div>
            </section>

            <section className="space-y-2">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
                            Your schedule
                        </h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Weekend days + time blocks for working days.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                    <div className="md:col-span-2">
                        <div className="h-full rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950/40">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        Weekend days
                                    </h4>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        Days off each week.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                {ISO_DAYS.map(({ iso, short }) => {
                                    const on = weekendDays.includes(iso);
                                    return (
                                        <button
                                            key={iso}
                                            type="button"
                                            onClick={() => toggleWeekend(iso)}
                                            aria-pressed={on}
                                            className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                                                on
                                                    ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
                                            }`}
                                        >
                                            {short}
                                        </button>
                                    );
                                })}
                            </div>

                            {weekendErr && (
                                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{weekendErr}</p>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-3">
                        <div className="rounded-2xl border border-gray-200/70 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950/40">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                        Working hours
                                    </h4>
                                    <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">
                                        Add one or more blocks. These apply to every working day.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addInterval}
                                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-black dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    Add block
                                </button>
                            </div>

                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between text-[11px] font-medium text-gray-400 dark:text-gray-500">
                                    <span>00</span>
                                    <span>06</span>
                                    <span>12</span>
                                    <span>18</span>
                                    <span>24</span>
                                </div>
                                <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">
                                    <div className="absolute inset-y-0 left-1/4 w-px bg-gray-300/60 dark:bg-gray-600/60" />
                                    <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300/60 dark:bg-gray-600/60" />
                                    <div className="absolute inset-y-0 left-3/4 w-px bg-gray-300/60 dark:bg-gray-600/60" />
                                    {intervalDiagnostics.merged.map((i) => {
                                        const left = (i.startMinutes / 1440) * 100;
                                        const width = ((i.endMinutes - i.startMinutes) / 1440) * 100;
                                        const title = `${formatMinutesLabel(i.startMinutes)} – ${formatMinutesLabel(i.endMinutes)}`;
                                        return (
                                            <div
                                                key={`${i.startMinutes}-${i.endMinutes}`}
                                                className="absolute top-0 h-full rounded-full bg-primary-600/85 dark:bg-primary-500/75"
                                                style={{ left: `${left}%`, width: `${width}%` }}
                                                title={title}
                                            />
                                        );
                                    })}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Timeline preview (per working day)
                                </p>
                            </div>

                            <div className="mt-5">
                                {draftIntervals.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
                                        No time blocks yet. Add one to reflect your availability.
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        {draftIntervals.map((s) => (
                                            <li
                                                key={s.key}
                                                className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200/60 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900/30"
                                            >
                                                <label className="flex min-w-[7rem] flex-col gap-1">
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        Start
                                                    </span>
                                                    <input
                                                        type="time"
                                                        value={minutesToTimeValue(s.startMinutes)}
                                                        onChange={(e) =>
                                                            updateInterval(s.key, {
                                                                startMinutes: timeValueToMinutes(e.target.value),
                                                            })
                                                        }
                                                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-950/40 dark:text-white"
                                                    />
                                                </label>
                                                <label className="flex min-w-[7rem] flex-col gap-1">
                                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                                        End
                                                    </span>
                                                    <input
                                                        type="time"
                                                        value={minutesToTimeValue(s.endMinutes)}
                                                        onChange={(e) =>
                                                            updateInterval(s.key, {
                                                                endMinutes: timeValueToMinutes(e.target.value),
                                                            })
                                                        }
                                                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-950/40 dark:text-white"
                                                    />
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => removeInterval(s.key)}
                                                    className="ml-auto rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                                    aria-label="Remove interval"
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {(intervalDiagnostics.hard.length > 0 || intervalDiagnostics.soft.length > 0) && (
                                <div className="mt-4 space-y-2">
                                    {intervalDiagnostics.hard.map((m) => (
                                        <div
                                            key={`hard-${m}`}
                                            className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
                                        >
                                            {m}
                                        </div>
                                    ))}
                                    {intervalDiagnostics.soft.map((m) => (
                                        <div
                                            key={`soft-${m}`}
                                            className="rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                                        >
                                            {m}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-6 flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {saving ? (
                                        <span className="inline-flex items-center gap-2">
                                            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" />
                                            Saving…
                                        </span>
                                    ) : !hydratedFromSchedule ? (
                                        'Loading…'
                                    ) : isDirty ? (
                                        <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                            Unsaved changes
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 dark:text-gray-500">All changes saved</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!canSave}
                                    title={
                                        !hydratedFromSchedule
                                            ? 'Loading…'
                                            : !isDirty
                                              ? 'No changes to save'
                                              : hardIssues
                                                ? 'Fix issues to save'
                                                : undefined
                                    }
                                    className="btn-primary w-full rounded-full px-6 sm:w-auto sm:min-w-[10rem] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? 'Saving…' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
