export interface RecentTaskEntry {
    id: string;
    title: string;
    projectId: string;
    projectName: string;
    listName?: string | null;
    status: string;
    viewedAt: number;
}

const MAX_RECENTS = 12;
export const EMPLOYEE_RECENTS_LIMIT = 5;
const storageKey = (userId: string) => `crm:recent-tasks:${userId}`;

export function getRecentTasks(userId: string | undefined): RecentTaskEntry[] {
    if (!userId || typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(storageKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as RecentTaskEntry[];
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((e) => e?.id && e?.title)
            .sort((a, b) => b.viewedAt - a.viewedAt)
            .slice(0, MAX_RECENTS);
    } catch {
        return [];
    }
}

export function pushRecentTask(
    userId: string | undefined,
    entry: Omit<RecentTaskEntry, 'viewedAt'>,
): void {
    if (!userId || typeof window === 'undefined') return;
    try {
        const existing = getRecentTasks(userId).filter((e) => e.id !== entry.id);
        const next: RecentTaskEntry[] = [{ ...entry, viewedAt: Date.now() }, ...existing].slice(
            0,
            MAX_RECENTS,
        );
        window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
        // Ignore quota / private mode errors
    }
}

/** Project name only (no list/folder) for compact “in …” labels, e.g. Recents. */
export function recentLocationLabel(entry: RecentTaskEntry): string {
    return entry.projectName || 'Project';
}

/** Map an assigned task row into a recent entry (for suggestions). */
export function taskToRecentEntry(task: {
    id: string;
    title: string;
    projectId: string;
    status: string;
    updatedAt?: string | null;
    project?: { id: string; name: string } | null;
    list?: { id: string; name: string } | null;
}): RecentTaskEntry {
    return {
        id: task.id,
        title: task.title,
        projectId: task.projectId,
        projectName: task.project?.name ?? 'Project',
        listName: task.list?.name ?? null,
        status: task.status,
        viewedAt: task.updatedAt ? new Date(task.updatedAt).getTime() : 0,
    };
}

/**
 * Show tasks the user actually opened first, then fill with recently updated assigned
 * tasks so the list does not collapse to a single item after the first click.
 */
/** Latest N assigned tasks by `updatedAt` (employee My Tasks recents). */
export function latestAssignedRecentEntries(
    tasks: Array<{
        id: string;
        title: string;
        projectId: string;
        status: string;
        updatedAt?: string | null;
        project?: { id: string; name: string } | null;
        list?: { id: string; name: string } | null;
    }>,
    limit = EMPLOYEE_RECENTS_LIMIT,
): RecentTaskEntry[] {
    return [...tasks]
        .sort((a, b) => {
            const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return tb - ta;
        })
        .slice(0, limit)
        .map((t) => taskToRecentEntry(t));
}

export function mergeRecentWithAssigned(
    stored: RecentTaskEntry[],
    assignedTasks: Array<{
        id: string;
        title: string;
        projectId: string;
        status: string;
        updatedAt?: string | null;
        project?: { id: string; name: string } | null;
        list?: { id: string; name: string } | null;
    }>,
    max = MAX_RECENTS,
): RecentTaskEntry[] {
    const viewed = [...stored].sort((a, b) => b.viewedAt - a.viewedAt);
    const viewedIds = new Set(viewed.map((e) => e.id));

    const filler = [...assignedTasks]
        .sort((a, b) => {
            const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return tb - ta;
        })
        .filter((t) => !viewedIds.has(t.id))
        .slice(0, Math.max(0, max - viewed.length))
        .map((t) => taskToRecentEntry(t));

    return [...viewed, ...filler].slice(0, max);
}
