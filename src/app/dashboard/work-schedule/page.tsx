'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { client } from '@/lib/apollo-client';
import {
    GET_MY_WEEKLY_WORK_PLAN_FOR_DATE,
    GET_TEAM_WEEKLY_SCHEDULE_FOR_DATE,
    SET_WEEKLY_WORK_PLAN,
    DELETE_WEEKLY_WORK_PLAN,
} from '@/lib/graphql/queries';
import { useAuthStore } from '@/lib/store';
import { canViewTeamWorkSchedule } from '@/lib/permissions';
import { useToast } from '@/components/ToastProvider';
import {
    CalendarDaysIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    TrashIcon,
    PlusIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import { addDays, format } from 'date-fns';
import {
    isPlanActiveNow,
    toDateOnlyISOStringFromLocal,
    computeWorkWeekStartDay,
} from '@/lib/work-schedule/scheduleActiveNow';

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

function formatHoursFromMinutes(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h <= 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

type DraftSlot = {
    key: string;
    dayOfWeek: number;
    startMinutes: number;
    endMinutes: number;
};

export default function WorkSchedulePage() {
    const { showToast } = useToast();
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

    const [weekendDays, setWeekendDays] = useState<number[]>([5]);
    const [draftSlots, setDraftSlots] = useState<DraftSlot[]>([]);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [weekStartDayError, setWeekStartDayError] = useState<string | null>(null);
    const [teamFilter, setTeamFilter] = useState<'all' | 'active' | 'inactive'>(
        'all',
    );
    const [isWeekTransitioning, setIsWeekTransitioning] = useState(false);
    /** Re-render periodically so team Active/Inactive updates with the clock. */
    const [liveStatusTick, setLiveStatusTick] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setLiveStatusTick((n) => n + 1), 30_000);
        return () => window.clearInterval(id);
    }, []);

    const {
        data: myData,
        loading: myLoading,
        networkStatus: myNetworkStatus,
        refetch: refetchMy,
    } = useQuery(GET_MY_WEEKLY_WORK_PLAN_FOR_DATE, {
        variables: { referenceDate: referenceDateIso },
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true,
    });

    const {
        data: teamData,
        loading: teamLoading,
        networkStatus: teamNetworkStatus,
        refetch: refetchTeam,
    } = useQuery(
        GET_TEAM_WEEKLY_SCHEDULE_FOR_DATE,
        {
            variables: { referenceDate: referenceDateIso },
            skip: !showTeam,
            fetchPolicy: 'network-only',
            notifyOnNetworkStatusChange: true,
        },
    );

    const [setPlan, { loading: saving }] = useMutation(SET_WEEKLY_WORK_PLAN);
    const [deletePlan, { loading: deleting }] = useMutation(DELETE_WEEKLY_WORK_PLAN);

    const myPlan = myData?.myWeeklyWorkPlanForDate ?? null;
    const teamRows =
        (teamData?.teamWeeklyScheduleForDate as
            | Array<{
                  user: { id: string; name: string; email: string };
                  plan: {
                      weekStart: string;
                      weekendDays: number[];
                      slots: {
                          id: string;
                          dayOfWeek: number;
                          startMinutes: number;
                          endMinutes: number;
                      }[];
                  } | null;
              }>
            | undefined) ?? [];

    const isDirty = useMemo(() => {
        const loadedWeekend = [...(myPlan?.weekendDays ?? [5])].sort((a, b) => a - b);
        const currentWeekend = [...weekendDays].sort((a, b) => a - b);
        const weekendChanged =
            loadedWeekend.length !== currentWeekend.length ||
            loadedWeekend.some((v, i) => v !== currentWeekend[i]);

        const loadedSlots = (myPlan?.slots ?? [])
            .map((s: any) => ({
                dayOfWeek: s.dayOfWeek,
                startMinutes: s.startMinutes,
                endMinutes: s.endMinutes,
            }))
            .sort((a: any, b: any) =>
                a.dayOfWeek !== b.dayOfWeek
                    ? a.dayOfWeek - b.dayOfWeek
                    : a.startMinutes - b.startMinutes,
            );

        const currentSlots = draftSlots
            .map((s) => ({
                dayOfWeek: s.dayOfWeek,
                startMinutes: s.startMinutes,
                endMinutes: s.endMinutes,
            }))
            .sort((a, b) =>
                a.dayOfWeek !== b.dayOfWeek ? a.dayOfWeek - b.dayOfWeek : a.startMinutes - b.startMinutes,
            );

        const slotsChanged =
            loadedSlots.length !== currentSlots.length ||
            loadedSlots.some((s: any, i: number) => {
                const c = currentSlots[i];
                return (
                    !c ||
                    s.dayOfWeek !== c.dayOfWeek ||
                    s.startMinutes !== c.startMinutes ||
                    s.endMinutes !== c.endMinutes
                );
            });

        return weekendChanged || slotsChanged;
    }, [myPlan, weekendDays, draftSlots]);

    const activeUserCount = useMemo(() => {
        const now = new Date();
        return teamRows.filter((r) => r.plan && isPlanActiveNow(r.plan, now)).length;
    }, [teamRows, liveStatusTick]);
    const inactiveUserCount = useMemo(
        () => teamRows.length - activeUserCount,
        [teamRows.length, activeUserCount],
    );

    const filteredTeamRows = useMemo(() => {
        const now = new Date();
        if (teamFilter === 'active')
            return teamRows.filter((r) => r.plan && isPlanActiveNow(r.plan, now));
        if (teamFilter === 'inactive')
            return teamRows.filter((r) => !r.plan || !isPlanActiveNow(r.plan, now));
        return teamRows;
    }, [teamRows, teamFilter, liveStatusTick]);
    const weekendMatchesLoaded = useMemo(() => {
        if (!myPlan) return false;
        const loaded = [...(myPlan.weekendDays ?? [])].sort((a, b) => a - b);
        const current = [...weekendDays].sort((a, b) => a - b);
        if (loaded.length !== current.length) return false;
        return loaded.every((v, i) => v === current[i]);
    }, [myPlan, weekendDays]);

    const isMyFetching =
        myNetworkStatus === 1 /* loading */ ||
        myNetworkStatus === 2 /* setVariables */ ||
        myNetworkStatus === 4 /* refetch */;
    const isTeamFetching =
        teamNetworkStatus === 1 || teamNetworkStatus === 2 || teamNetworkStatus === 4;

    useEffect(() => {
        if (myLoading && !myPlan) return;
        if (!myPlan) {
            setWeekendDays([5]);
            setDraftSlots([]);
            return;
        }

        const p = myPlan;
        setWeekendDays(
            p.weekendDays?.length ? [...p.weekendDays].sort((a, b) => a - b) : [5],
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

    useEffect(() => {
        if (!isWeekTransitioning) return;
        const t = window.setTimeout(() => setIsWeekTransitioning(false), 220);
        return () => window.clearTimeout(t);
    }, [isWeekTransitioning]);

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
            showToast({ variant: 'error', title: 'Cannot save', message: built.error });
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
            const msg = e instanceof Error ? e.message : 'Invalid weekend selection';
            setWeekStartDayError(msg);
            showToast({ variant: 'error', title: 'Invalid weekend', message: msg });
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
            showToast({ variant: 'success', title: 'Saved', message: 'Schedule saved.' });
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as { message: string }).message)
                    : 'Save failed';
            setSaveError(msg);
            showToast({ variant: 'error', title: 'Save failed', message: msg });
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
            showToast({ variant: 'success', title: 'Cleared', message: 'Schedule cleared.' });
        } catch (e: unknown) {
            const msg =
                e && typeof e === 'object' && 'message' in e
                    ? String((e as { message: string }).message)
                    : 'Delete failed';
            setSaveError(msg);
            showToast({ variant: 'error', title: 'Clear failed', message: msg });
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
                        onClick={() => {
                            setIsWeekTransitioning(true);
                            setReferenceDate((d) => addDays(d, -7));
                        }}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        aria-label="Previous week"
                        disabled={isWeekTransitioning}
                    >
                        <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setIsWeekTransitioning(true);
                            setReferenceDate((d) => addDays(d, 7));
                        }}
                        className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                        aria-label="Next week"
                        disabled={isWeekTransitioning}
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
                        setIsWeekTransitioning(true);
                        setReferenceDate(d);
                    }}
                    className="btn-secondary text-sm self-start sm:self-auto"
                >
                    This week
                </button>
            </div>

            {/* Feedback is shown via global toasts */}            

            {/* My schedule */}
            <div className="card">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {userName ? `${userName}'s schedule` : 'My schedule'}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {isDirty ? (
                                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 px-2 py-0.5 font-medium">
                                    Unsaved changes
                                </span>
                            ) : (
                                <span className="inline-flex items-center rounded-full bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-200 px-2 py-0.5 font-medium">
                                    Saved
                                </span>
                            )}
                            {(myPlan as any)?.updatedAt && (
                                <span className="text-gray-500 dark:text-gray-400">
                                    Last saved {new Date((myPlan as any).updatedAt).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    const prevDate = addDays(referenceDate, -7);
                                    const prevIso = toDateOnlyISOStringFromLocal(prevDate);
                                    const res = await client.query({
                                        query: GET_MY_WEEKLY_WORK_PLAN_FOR_DATE,
                                        variables: { referenceDate: prevIso },
                                        fetchPolicy: 'network-only',
                                    });
                                    const prevPlan = res.data?.myWeeklyWorkPlanForDate;
                                    if (!prevPlan) {
                                        showToast({
                                            variant: 'info',
                                            title: 'Nothing to copy',
                                            message: 'No schedule found for the previous week.',
                                        });
                                        return;
                                    }
                                    setWeekendDays(
                                        prevPlan.weekendDays?.length
                                            ? [...prevPlan.weekendDays].sort(
                                                  (a: number, b: number) => a - b,
                                              )
                                            : [5],
                                    );
                                    setDraftSlots(
                                        (prevPlan.slots ?? []).map(
                                            (s: {
                                                id: string;
                                                dayOfWeek: number;
                                                startMinutes: number;
                                                endMinutes: number;
                                            }) => ({
                                                key: crypto.randomUUID(),
                                                dayOfWeek: s.dayOfWeek,
                                                startMinutes: s.startMinutes,
                                                endMinutes: s.endMinutes,
                                            }),
                                        ),
                                    );
                                    showToast({
                                        variant: 'success',
                                        title: 'Copied',
                                        message:
                                            'Copied schedule from the previous week (not saved yet).',
                                    });
                                } catch (e: unknown) {
                                    const msg =
                                        e &&
                                        typeof e === 'object' &&
                                        'message' in e
                                            ? String((e as { message: string }).message)
                                            : 'Copy failed';
                                    showToast({
                                        variant: 'error',
                                        title: 'Copy failed',
                                        message: msg,
                                    });
                                }
                            }}
                            className="btn-secondary text-sm"
                        >
                            Copy last week
                        </button>
                    </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    Choose weekend days (non-working). Add one or more time ranges on each working day. Week start depends on your weekend.
                </p>

                <div className={`transition-opacity duration-200 ${isMyFetching || isWeekTransitioning ? 'opacity-70' : 'opacity-100'}`}>
                    <>
                        <div className="mb-8">
                            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Weekend days</h3>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const preset = [6, 7];
                                        setWeekendDays(preset);
                                        setDraftSlots((prev) =>
                                            prev.filter((s) => !preset.includes(s.dayOfWeek)),
                                        );
                                        showToast({
                                            variant: 'info',
                                            title: 'Weekend preset',
                                            message: 'Applied Sat–Sun weekend.',
                                        });
                                    }}
                                    className="btn-secondary text-sm"
                                >
                                    Sat–Sun
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const preset = [5, 6];
                                        setWeekendDays(preset);
                                        setDraftSlots((prev) =>
                                            prev.filter((s) => !preset.includes(s.dayOfWeek)),
                                        );
                                        showToast({
                                            variant: 'info',
                                            title: 'Weekend preset',
                                            message: 'Applied Fri–Sat weekend.',
                                        });
                                    }}
                                    className="btn-secondary text-sm"
                                >
                                    Fri–Sat
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const preset = [5];
                                        setWeekendDays(preset);
                                        setDraftSlots((prev) =>
                                            prev.filter((s) => !preset.includes(s.dayOfWeek)),
                                        );
                                        showToast({
                                            variant: 'info',
                                            title: 'Weekend preset',
                                            message: 'Applied Friday weekend.',
                                        });
                                    }}
                                    className="btn-secondary text-sm"
                                >
                                    Friday
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const preset = [7];
                                        setWeekendDays(preset);
                                        setDraftSlots((prev) =>
                                            prev.filter((s) => !preset.includes(s.dayOfWeek)),
                                        );
                                        showToast({
                                            variant: 'info',
                                            title: 'Weekend preset',
                                            message: 'Applied Sunday weekend.',
                                        });
                                    }}
                                    className="btn-secondary text-sm"
                                >
                                    Sunday
                                </button>
                            </div>
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
                                const dayTotalMinutes = daySlots.reduce(
                                    (sum, s) =>
                                        sum +
                                        Math.max(0, s.endMinutes - s.startMinutes),
                                    0,
                                );
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
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {formatHoursFromMinutes(dayTotalMinutes)}
                                                </span>
                                            )}
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

                        <div className="mt-6 flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 bg-white/60 dark:bg-gray-900/20">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Total scheduled this week
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {formatHoursFromMinutes(
                                    draftSlots.reduce(
                                        (sum, s) =>
                                            sum +
                                            Math.max(0, s.endMinutes - s.startMinutes),
                                        0,
                                    ),
                                )}
                            </span>
                        </div>

                        <div className="mt-8 flex flex-wrap gap-3">
                            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary">
                                {saving ? 'Saving…' : 'Save Schedule'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setDeleteConfirm(true)}
                                disabled={deleting || !myPlan || !weekendMatchesLoaded}
                                className="btn-secondary text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 disabled:opacity-50"
                            >
                                Clear Schedule
                            </button>
                        </div>
                    </>
                </div>
            </div>

            {/* Team overview (admin / lead / HR) */}
            {showTeam && (
                <div className="card">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                                <UserGroupIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                                Team schedules
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Active users are employees who are currently within their scheduled work time.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 px-3 py-2 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Active</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {activeUserCount}
                                </span>
                                <span className="text-gray-300 dark:text-gray-600">/</span>
                                <span className="text-gray-600 dark:text-gray-400">Inactive</span>
                                <span className="font-semibold text-gray-900 dark:text-white">
                                    {inactiveUserCount}
                                </span>
                            </div>

                            <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/20 p-1">
                                <button
                                    type="button"
                                    onClick={() => setTeamFilter('all')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        teamFilter === 'all'
                                            ? 'bg-primary-600 text-white'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTeamFilter('active')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        teamFilter === 'active'
                                            ? 'bg-primary-600 text-white'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                                    }`}
                                >
                                    Active
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTeamFilter('inactive')}
                                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                        teamFilter === 'inactive'
                                            ? 'bg-primary-600 text-white'
                                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60'
                                    }`}
                                >
                                    Inactive
                                </button>
                            </div>
                        </div>
                    </div>

                    {teamLoading ? (
                        <div className="py-12 text-center">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto" />
                        </div>
                    ) : (
                        <div className={`space-y-6 transition-opacity duration-200 ${isTeamFetching || isWeekTransitioning ? 'opacity-70' : 'opacity-100'}`}>
                            {filteredTeamRows.length === 0 ? (
                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-400 text-center">
                                    No employees match this filter.
                                </div>
                            ) : (
                                filteredTeamRows.map((row) => {
                                    if (!row.plan) {
                                        return (
                                            <div key={row.user.id} className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="font-medium text-gray-900 dark:text-white">{row.user.name}</div>
                                                        <div className="text-xs text-gray-500 truncate" title={row.user.email}>
                                                            {row.user.email}
                                                        </div>
                                                    </div>
                                                    <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 text-xs font-medium">
                                                        Inactive
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">— No schedule saved</p>
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

                                    const isActiveNow = isPlanActiveNow(plan, new Date());

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
                                                {isActiveNow ? (
                                                    <span className="inline-flex items-center rounded-full bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 px-2 py-0.5 text-xs font-medium">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 text-xs font-medium">
                                                        Inactive
                                                    </span>
                                                )}
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
                                })
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
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Clear this schedule?</h3>
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
                                {deleting ? 'Clearing…' : 'Clear schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
