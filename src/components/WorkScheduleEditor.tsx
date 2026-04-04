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
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

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

export interface WorkScheduleEditorProps {
    /** When set, edits that user’s schedule (managers only; mutation setUserWorkSchedule). */
    targetUserId?: string;
    targetName?: string;
    /**
     * When true (e.g. admin on work-schedule page), saving “your” schedule also refetches the
     * team table so your row updates without a full page reload.
     */
    refetchTeamAfterMineSave?: boolean;
}

export default function WorkScheduleEditor({
    targetUserId,
    targetName,
    refetchTeamAfterMineSave = false,
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
        setWeekendDays(
            [...(schedule.weekendDays?.length ? schedule.weekendDays : [5])].sort(
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

    const canSave =
        hydratedFromSchedule && isDirty && !weekendErr && !saving;

    const handleSave = async () => {
        const wErr = validateWeekendDays(weekendDays);
        if (wErr) {
            setWeekendError(wErr);
            showToast({ variant: 'error', message: wErr });
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
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {isAdmin && targetName && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Editing schedule for <span className="font-medium text-gray-900 dark:text-white">{targetName}</span>
                </p>
            )}

            <section>
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                    Weekend
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Non-working days each week (Mon–Sun). Default is <strong>Fri</strong> only.
                    Tap adjacent days to extend — valid examples: Fri–Sat,{' '}
                    <strong>Fri–Sat–Sun</strong>, Sat–Sun, Sun only, or Sat–Sun–Mon. You cannot pick
                    two separate runs (e.g. Fri + Sun without Sat).
                </p>
                <div className="flex flex-wrap gap-2">
                    {ISO_DAYS.map(({ iso, short }) => {
                        const on = weekendDays.includes(iso);
                        return (
                            <button
                                key={iso}
                                type="button"
                                onClick={() => toggleWeekend(iso)}
                                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    on
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                }`}
                            >
                                {short}
                            </button>
                        );
                    })}
                </div>
                {weekendErr && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{weekendErr}</p>
                )}
            </section>

            <section>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                        Working hours
                    </h2>
                    <button
                        type="button"
                        onClick={addInterval}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                        <PlusIcon className="h-4 w-4" />
                        Add interval
                    </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    These times apply to <strong>every</strong> working day (all days that are not
                    in your weekend). You can add several intervals (e.g. morning and afternoon).
                </p>

                {draftIntervals.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                        No intervals yet. Add at least one to appear as &quot;Active&quot; during
                        those times.
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {draftIntervals.map((s) => (
                            <li
                                key={s.key}
                                className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800/50"
                            >
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">From</span>
                                    <input
                                        type="time"
                                        value={minutesToTimeValue(s.startMinutes)}
                                        onChange={(e) =>
                                            updateInterval(s.key, {
                                                startMinutes: timeValueToMinutes(e.target.value),
                                            })
                                        }
                                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm py-2 px-2"
                                    />
                                </label>
                                <label className="flex flex-col gap-1">
                                    <span className="text-xs text-gray-500 dark:text-gray-400">To</span>
                                    <input
                                        type="time"
                                        value={minutesToTimeValue(s.endMinutes)}
                                        onChange={(e) =>
                                            updateInterval(s.key, {
                                                endMinutes: timeValueToMinutes(e.target.value),
                                            })
                                        }
                                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm py-2 px-2"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => removeInterval(s.key)}
                                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                    aria-label="Remove interval"
                                >
                                    <TrashIcon className="h-5 w-5" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <div className="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canSave}
                    title={
                        !hydratedFromSchedule
                            ? 'Loading…'
                            : !isDirty
                              ? 'No changes to save'
                              : weekendErr
                                ? 'Fix weekend selection to save'
                                : undefined
                    }
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? 'Saving…' : 'Save schedule'}
                </button>
            </div>
        </div>
    );
}
