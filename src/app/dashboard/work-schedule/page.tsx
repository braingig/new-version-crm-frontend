'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import {
    GET_MY_WEEKLY_WORK_PLAN_FOR_DATE,
    GET_TEAM_WEEKLY_SCHEDULE_FOR_DATE,
    SET_WEEKLY_WORK_PLAN,
    DELETE_WEEKLY_WORK_PLAN,
} from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store';
import { canViewTeamWorkSchedule } from '@/lib/permissions';
import {
    CalendarDaysIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    TrashIcon,
    PlusIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import { addDays, format } from 'date-fns';

/** ISO weekday: 1 = Monday … 7 = Sunday */
const ISO_DAYS: { iso: number; short: string; label: string }[] = [
    { iso: 1, short: 'Mon', label: 'Monday' },
    { iso: 2, short: 'Tue', label: 'Tuesday' },
    { iso: 3, short: 'Wed', label: 'Wednesday' },
    { iso: 4, short: 'Thu', label: 'Thursday' },
    { iso: 5, short: 'Fri', label: 'Friday' },
    { iso: 6, short: 'Sat', label: 'Saturday' },
    { iso: 7, short: 'Sun', label: 'Sunday' },
];

function isoDayFromLocal(date: Date): number {
    const d = new Date(date);
    const js = d.getDay(); // 0=Sun..6=Sat
    return js === 0 ? 7 : js;
}

function toDateOnlyISOStringFromLocal(localMidnight: Date): string {
    return new Date(
        Date.UTC(
            localMidnight.getFullYear(),
            localMidnight.getMonth(),
            localMidnight.getDate(),
        ),
    ).toISOString();
}

function nextIsoDay(iso: number): number {
    return iso === 7 ? 1 : iso + 1;
}

function computeWorkWeekStartDay(weekendDays: number[]): number {
    // weekendDays are ISO: 1=Mon ... 7=Sun
    // Work week start = first working day after the weekend block ends.
    const isWeekend: boolean[] = Array.from({ length: 8 }, () => false); // 0..7 (0 unused)
    for (const d of weekendDays) isWeekend[d] = true;

    const boundaries: number[] = [];
    for (let dayIso = 1; dayIso <= 7; dayIso++) {
        const isBoundaryEnd = isWeekend[dayIso] && !isWeekend[nextIsoDay(dayIso)];
        if (isBoundaryEnd) boundaries.push(dayIso);
    }

    // For a single consecutive weekend block there should be exactly 1 boundary end.
    if (boundaries.length !== 1) {
        throw new Error(
            'weekendDays must form one consecutive block (e.g. Fri or Fri-Sat or Sat-Sun).',
        );
    }
    const endWeekendDay = boundaries[0];
    return nextIsoDay(endWeekendDay);
}

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

function formatMinutesLabel(m: number): string {
    const h = Math.floor(m / 60);
    const mi = m % 60;
    const ap = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return mi ? `${h12}:${String(mi).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
}

type DraftSlot = {
    key: string;
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
};

export default function WorkSchedulePage() {
    const role = useAuthStore((s) => s.user?.role);
    const userName = useAuthStore((s) => s.user?.name);
    const showTeam = canViewTeamWorkSchedule(role);

    const [referenceDate, setReferenceDate] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });
    const referenceDateIso = useMemo(
        () => toDateOnlyISOStringFromLocal(referenceDate),
        [referenceDate],
    );

    const [weekendDays, setWeekendDays] = useState<number[]>([6, 7]);
    const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [weekStartDayError, setWeekStartDayError] = useState<string | null>(null);

    const { data: myData, loading: myLoading, refetch: refetchMy } = useQuery(GET_MY_WEEKLY_WORK_PLAN_FOR_DATE, {
        variables: { referenceDate: referenceDateIso },
        fetchPolicy: 'network-only',
    });

    const { data: teamData, loading: teamLoading, refetch: refetchTeam } = useQuery(
        GET_TEAM_WEEKLY_SCHEDULE_FOR_DATE,
        {
            variables: { referenceDate: referenceDateIso },
            skip: !showTeam,
            fetchPolicy: 'network-only',
        },
    );

    const [setPlan, { loading: saving }] = useMutation(SET_WEEKLY_WORK_PLAN);
    const [deletePlan, { loading: deleting }] = useMutation(DELETE_WEEKLY_WORK_PLAN);

    const myPlan = myData?.myWeeklyWorkPlanForDate ?? null;
    const weekendMatchesLoaded = useMemo(() => {
        if (!myPlan) return false;
        const loaded = [...(myPlan.weekendDays ?? [])].sort((a, b) => a - b);
        const current = [...weekendDays].sort((a, b) => a - b);
        if (loaded.length !== current.length) return false;
        return loaded.every((v, i) => v === current[i]);
    }, [myPlan, weekendDays]);

    useEffect(() => {
        if (myLoading) return;
        if (!myPlan) {
            setWeekendDays([6, 7]);
            setDraftSlots([]);
            return;
        }

        const p = myPlan;
        setWeekendDays(
            p.weekendDays?.length ? [...p.weekendDays].sort((a, b) => a - b) : [6, 7],
        );
        setDraftSlots(
            (p.slots ?? []).map((s: { id: string; dayOfWeek: number; startMinutes: number; endMinutes: number }) => ({
                key: s.id,
                dayOfWeek: s.dayOfWeek,
                startMinutes: s.startMinutes,
                endMinutes: s.endMinutes,
            })),
        );
    }, [myLoading, referenceDateIso, myPlan]);

    const toggleWeekend = useCallback((iso: number) => {
        setWeekStartDayError(null);
        setWeekendDays((prev) => {
            const next = prev.includes(iso)
                ? prev.filter((d) => d !== iso)
                : [...prev, iso].sort((a, b) => a - b);
            return next;
        });
        setDraftSlots((prev) => prev.filter((s) => s.dayOfWeek !== iso));
    }, []);

    const addSlot = useCallback((dayOfWeek: number) => {
        setDraftSlots((prev) => [
            ...prev,
            {
                key: crypto.randomUUID(),
                dayOfWeek,
                startMinutes: 9 * 60,
                endMinutes: 17 * 60,
            },
        ]);
    }, []);

    const updateSlot = useCallback((key: string, patch: Partial<Pick<DraftSlot, 'startMinutes' | 'endMinutes'>>) => {
        setDraftSlots((prev) =>
            prev.map((s) => (s.key === key ? { ...s, ...patch } : s)),
        );
    }, []);

    const removeSlot = useCallback((key: string) => {
        setDraftSlots((prev) => prev.filter((s) => s.key !== key));
    }, []);

    const validateAndBuildPayload = useCallback(():
        | { ok: true; slots: { dayOfWeek: number; startMinutes: number; endMinutes: number }[] }
        | { ok: false; error: string } => {
        const weekendSet = new Set(weekendDays);
        for (const s of draftSlots) {
            if (weekendSet.has(s.dayOfWeek)) {
                return {
                    ok: false,
                    error:
                        'Remove working hours from days marked as weekend, or uncheck those weekend days.',
                };
            }
            if (s.startMinutes >= s.endMinutes) {
                return {
                    ok: false,
                    error: `Each interval needs a start time before end time (${ISO_DAYS.find((d) => d.iso === s.dayOfWeek)?.label ?? 'day'}).`,
                };
            }
        }
        const byDay = new Map<number, DraftSlot[]>();
        for (const s of draftSlots) {
            if (!byDay.has(s.dayOfWeek)) byDay.set(s.dayOfWeek, []);
            byDay.get(s.dayOfWeek)!.push(s);
        }
        for (const [dayIso, list] of byDay) {
            const sorted = [...list].sort((a, b) => a.startMinutes - b.startMinutes);
            const dayLabel = ISO_DAYS.find((d) => d.iso === dayIso)?.label ?? 'That day';
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].startMinutes < sorted[i - 1].endMinutes) {
                    return {
                        ok: false,
                        error: `${dayLabel}: two ranges overlap. Often the start is set to AM instead of PM (e.g. 4:00 AM vs 4:00 PM). Adjust the times so ranges do not cross.`,
                    };
                }
            }
        }
        return {
            ok: true,
            slots: draftSlots.map((s) => ({
                dayOfWeek: s.dayOfWeek,
                startMinutes: s.startMinutes,
                endMinutes: s.endMinutes,
            })),
        };
    }, [draftSlots, weekendDays]);

    const handleSave = async () => {
        setSaveError(null);
        setWeekStartDayError(null);
        const built = validateAndBuildPayload();
        if (!built.ok) {
            setSaveError(built.error);
            return;
        }

        let computedWeekStartIso: string;
        let computedWeekStartLocal: Date;
        try {
            const startDay = computeWorkWeekStartDay(weekendDays);
            const refIso = isoDayFromLocal(referenceDate);
            const diff = (refIso - startDay + 7) % 7;
            computedWeekStartLocal = addDays(referenceDate, -diff);
            computedWeekStartLocal.setHours(0, 0, 0, 0);
            computedWeekStartIso = toDateOnlyISOStringFromLocal(computedWeekStartLocal);
        } catch (e) {
            setWeekStartDayError(e instanceof Error ? e.message : 'Invalid weekend selection');
            return;
        }

        try {
            await setPlan({
                variables: {
                    input: {
                        weekStart: computedWeekStartIso,
                        weekendDays,
                        slots: built.slots,
                    },
                },
            });
            await refetchMy();
            if (showTeam) await refetchTeam();
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as { message: string }).message)
                    : 'Save failed';
            setSaveError(msg);
        }
    };

    const handleDeleteWeek = async () => {
        setSaveError(null);
        try {
            if (!myPlan?.weekStart) return;
            await deletePlan({ variables: { weekStart: myPlan.weekStart } });
            setDeleteConfirm(false);
            await refetchMy();
            if (showTeam) await refetchTeam();
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as { message: string }).message)
                    : 'Delete failed';
            setSaveError(msg);
        }
    };

    let computedWeekStartDay = 1;
    try {
        computedWeekStartDay = computeWorkWeekStartDay(weekendDays);
    } catch {
        // handled on save; keep UI usable
    }

    const orderedIsoDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => {
            const iso = ((computedWeekStartDay - 1 + i) % 7) + 1;
            return iso;
        });
    }, [computedWeekStartDay]);

    let weekStartLocalForGrid = referenceDate;
    try {
        const startDay = computeWorkWeekStartDay(weekendDays);
        const refIso = isoDayFromLocal(referenceDate);
        const diff = (refIso - startDay + 7) % 7;
        weekStartLocalForGrid = addDays(referenceDate, -diff);
        weekStartLocalForGrid.setHours(0, 0, 0, 0);
    } catch {
        // ignore
    }

    const weekRangeLabel = `${format(weekStartLocalForGrid, 'MMM d')} – ${format(addDays(weekStartLocalForGrid, 6), 'MMM d, yyyy')}`;

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <CalendarDaysIcon className="h-8 w-8 text-primary-600 dark:text-primary-400 shrink-0" />
                    Work schedule
                </h1>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Set your weekend days and working hours for each week. You can update this anytime. Times are in your
                    local time (wall clock).
                </p>
            </div>

            {/* Week navigation */}
            <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setReferenceDate((d) => addDays(d, -7))}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        aria-label="Previous week"
                    >
                        <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setReferenceDate((d) => addDays(d, 7))}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        aria-label="Next week"
                    >
                        <ChevronRightIcon className="h-5 w-5" />
                    </button>
                    <div className="ml-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{weekRangeLabel}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Work week anchored by your weekend setup</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        const d = new Date();
                        d.setHours(0, 0, 0, 0);
                        setReferenceDate(d);
                    }}
                    className="btn-secondary text-sm self-start sm:self-auto"
                >
                    This week
                </button>
            </div>

            {saveError && (
                <div
                    className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200"
                    role="alert"
                >
                    {saveError}
                </div>
            )}

            {weekStartDayError && (
                <div
                    className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200"
                    role="alert"
                >
                    {weekStartDayError}
                </div>
            )}

            {/* My schedule */}
            <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {userName ? `${userName}'s plan` : 'My plan'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Choose weekend days (non-working). Add one or more time ranges on each working day. Week start depends on your weekend.
                </p>

                {myLoading ? (
                    <div className="py-12 text-center">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
                    </div>
                ) : (
                    <>
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Weekend days</h3>
                            <div className="flex flex-wrap gap-2">
                                {ISO_DAYS.map((d) => (
                                    <label
                                        key={d.iso}
                                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                                            weekendDays.includes(d.iso)
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200'
                                                : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            checked={weekendDays.includes(d.iso)}
                                            onChange={() => toggleWeekend(d.iso)}
                                        />
                                        {d.short}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {orderedIsoDays.map((iso, idx) => {
                                const dayMeta = ISO_DAYS.find((d) => d.iso === iso)!;
                                const daySlots = draftSlots.filter((s) => s.dayOfWeek === iso);
                                const isWeekend = weekendDays.includes(iso);
                                const dayDate = addDays(weekStartLocalForGrid, idx);
                                return (
                                    <div
                                        key={iso}
                                        className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30"
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="font-medium text-gray-900 dark:text-white">
                                                {dayMeta.short}{' '}
                                                <span className="text-gray-500 dark:text-gray-400 font-normal">
                                                    {format(dayDate, 'MMM d')}
                                                </span>
                                            </span>
                                            {!isWeekend && (
                                                <button
                                                    type="button"
                                                    onClick={() => addSlot(iso)}
                                                    className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                                                >
                                                    <PlusIcon className="h-4 w-4" />
                                                    Add hours
                                                </button>
                                            )}
                                        </div>

                                        {isWeekend ? (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                                Off
                                            </p>
                                        ) : daySlots.length === 0 ? (
                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                No working hours — add a range or leave empty.
                                            </p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {daySlots.map((s) => (
                                                    <li
                                                        key={s.key}
                                                        className="flex flex-wrap items-center gap-2 sm:gap-3"
                                                    >
                                                        <input
                                                            type="time"
                                                            className="input py-1.5 w-auto max-w-[8rem]"
                                                            value={minutesToTimeValue(s.startMinutes)}
                                                            onChange={(e) =>
                                                                updateSlot(s.key, {
                                                                    startMinutes: timeValueToMinutes(e.target.value),
                                                                })
                                                            }
                                                        />
                                                        <span className="text-gray-500">–</span>
                                                        <input
                                                            type="time"
                                                            className="input py-1.5 w-auto max-w-[8rem]"
                                                            value={minutesToTimeValue(s.endMinutes)}
                                                            onChange={(e) =>
                                                                updateSlot(s.key, {
                                                                    endMinutes: timeValueToMinutes(e.target.value),
                                                                })
                                                            }
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => removeSlot(s.key)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                                            title="Remove"
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
                                {saving ? 'Saving…' : 'Save week'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeleteConfirm(true)}
                                disabled={deleting || !myPlan || !weekendMatchesLoaded}
                                className="btn-secondary text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 disabled:opacity-50"
                            >
                                Clear this week
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Team overview (admin / lead / HR) */}
            {showTeam && (
                <div className="card">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                        <UserGroupIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                        Team schedules
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Working hours submitted by each employee for the work-week that contains the selected date. “—” means no plan saved yet.
                    </p>

                    {teamLoading ? (
                        <div className="py-12 text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {(teamData?.teamWeeklyScheduleForDate ?? []).map(
                                (row: {
                                    user: { id: string; name: string; email: string };
                                    plan: {
                                        weekStart: string;
                                        weekendDays: number[];
                                        slots: { id: string; dayOfWeek: number; startMinutes: number; endMinutes: number }[];
                                    } | null;
                                }) => {
                                    if (!row.plan) {
                                        return (
                                            <div key={row.user.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                                <div className="font-medium text-gray-900 dark:text-white">{row.user.name}</div>
                                                <div className="text-xs text-gray-500 truncate" title={row.user.email}>
                                                    {row.user.email}
                                                </div>
                                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">— No plan saved</p>
                                            </div>
                                        );
                                    }

                                    const plan = row.plan;
                                    let startDay = 1;
                                    try {
                                        startDay = computeWorkWeekStartDay(plan.weekendDays ?? []);
                                    } catch {
                                        startDay = 1;
                                    }
                                    const dayOrder = Array.from({ length: 7 }, (_, i) => {
                                        return ((startDay - 1 + i) % 7) + 1;
                                    });

                                    const planWeekStart = new Date(plan.weekStart);
                                    const planWeekStartLocal = new Date(
                                        planWeekStart.getUTCFullYear(),
                                        planWeekStart.getUTCMonth(),
                                        planWeekStart.getUTCDate(),
                                    );

                                    return (
                                        <div key={row.user.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-white">{row.user.name}</div>
                                                    <div className="text-xs text-gray-500 truncate" title={row.user.email}>
                                                        {row.user.email}
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        {format(planWeekStartLocal, 'MMM d')} – {format(addDays(planWeekStartLocal, 6), 'MMM d, yyyy')}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                                {dayOrder.map((iso, idx) => {
                                                    const meta = ISO_DAYS.find((d) => d.iso === iso)!;
                                                    const dayDate = addDays(planWeekStartLocal, idx);
                                                    const isOff = (plan.weekendDays ?? []).includes(iso);
                                                    const slots = (plan.slots ?? []).filter((s) => s.dayOfWeek === iso);
                                                    return (
                                                        <div key={`${row.user.id}-${iso}`} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 bg-white/60 dark:bg-gray-900/20">
                                                            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                                                {meta.short}{' '}
                                                                <span className="text-gray-500 font-normal">
                                                                    {format(dayDate, 'MMM d')}
                                                                </span>
                                                            </div>
                                                            {isOff ? (
                                                                <p className="mt-1 text-sm text-gray-500 italic">Off</p>
                                                            ) : slots.length === 0 ? (
                                                                <p className="mt-1 text-sm text-gray-400">—</p>
                                                            ) : (
                                                                <ul className="mt-1 space-y-0.5">
                                                                    {slots.map((s) => (
                                                                        <li key={s.id} className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                                                            {formatMinutesLabel(s.startMinutes)} – {formatMinutesLabel(s.endMinutes)}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                },
                            )}
                        </div>
                    )}
                </div>
            )}

            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-black/40"
                        aria-label="Close"
                        onClick={() => setDeleteConfirm(false)}
                    />
                    <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clear this week?</h3>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            This removes your saved schedule for {weekRangeLabel}. You can set it again later.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button type="button" className="btn-secondary" onClick={() => setDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                                onClick={handleDeleteWeek}
                                disabled={deleting}
                            >
                                {deleting ? 'Clearing…' : 'Clear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
