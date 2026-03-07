'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@apollo/client';
import { GET_EMPLOYEE_DAILY_ACTIVITY, GET_USERS } from '@/lib/graphql/queries';
import { DocumentChartBarIcon, ArrowDownTrayIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

function formatSeconds(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function escapeHtml(s: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(s).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

export default function ReportsPage() {
    const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 13), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
    const [employeeId, setEmployeeId] = useState<string>('');

    const startDateTime = useMemo(() => startOfDay(new Date(startDate)).toISOString(), [startDate]);
    const endDateTime = useMemo(() => endOfDay(new Date(endDate)).toISOString(), [endDate]);

    const { data, loading, error } = useQuery(GET_EMPLOYEE_DAILY_ACTIVITY, {
        variables: {
            startDate: startDateTime,
            endDate: endDateTime,
            employeeId: employeeId || undefined,
        },
        fetchPolicy: 'network-only',
    });

    const { data: usersData } = useQuery(GET_USERS);
    const users = usersData?.users ?? [];

    const reportRows = data?.employeeDailyActivity ?? [];

    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;

    const downloadCsv = () => {
        const headers = ['Employee', 'Email', 'Date', 'Total time (day)', 'Project', 'Project time'];
        const rows: string[][] = [];
        reportRows.forEach((row: any) => {
            const dateStr = row.date ? format(new Date(row.date), 'yyyy-MM-dd') : '';
            const totalStr = formatSeconds(row.totalSeconds ?? 0);
            const projects = row.projects ?? [];
            if (projects.length === 0) {
                rows.push([row.employeeName ?? '', row.email ?? '', dateStr, totalStr, '—', '—']);
            } else {
                projects.forEach((p: any) => {
                    rows.push([
                        row.employeeName ?? '',
                        row.email ?? '',
                        dateStr,
                        totalStr,
                        p.projectName ?? '—',
                        formatSeconds(p.seconds ?? 0),
                    ]);
                });
            }
        });
        const csvContent = [
            headers.join(','),
            ...rows.map((r) => r.map(escapeCsv).join(',')),
        ].join('\r\n');
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `employee-report-${startDate}-to-${endDate}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    /* Download HTML – commented out for now
    const downloadHtml = () => {
        const title = 'Employee Time Report';
        const period = `${format(new Date(startDate), 'MMM d, yyyy')} – ${format(new Date(endDate), 'MMM d, yyyy')}`;
        const rowsHtml = reportRows
            .map((row: any) => {
                const dateStr = row.date ? format(new Date(row.date), 'MMM d, yyyy') : '—';
                const totalStr = formatSeconds(row.totalSeconds ?? 0);
                const projects = row.projects ?? [];
                const projectsList =
                    projects.length === 0
                        ? '<em>—</em>'
                        : projects
                              .map((p: any) => `<li>${escapeHtml(p.projectName ?? '—')}: ${formatSeconds(p.seconds ?? 0)}</li>`)
                              .join('');
                return `
          <tr>
            <td>${escapeHtml(row.employeeName ?? '—')}</td>
            <td>${escapeHtml(row.email ?? '—')}</td>
            <td>${dateStr}</td>
            <td><strong>${totalStr}</strong></td>
            <td><ul class="project-list">${projectsList}</ul></td>
          </tr>`;
            })
            .join('');
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif; margin: 0; padding: 24px; background: #f9fafb; color: #111827; }
    .container { max-width: 960px; margin: 0 auto; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow: hidden; }
    h1 { margin: 0 0 4px 0; font-size: 1.5rem; font-weight: 700; color: #111827; }
    .meta { font-size: 0.875rem; color: #6b7280; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f3f4f6; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
    tr:hover { background: #f9fafb; }
    .project-list { margin: 0; padding-left: 20px; }
    .project-list li { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div style="padding: 24px 24px 0 24px;">
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">${escapeHtml(period)} · Generated ${format(new Date(), 'MMM d, yyyy \'at\' HH:mm')}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Employee</th>
          <th>Email</th>
          <th>Date</th>
          <th>Total time</th>
          <th>Projects</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `employee-report-${startDate}-to-${endDate}.html`;
        link.click();
        URL.revokeObjectURL(link.href);
    };
    */

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <DocumentChartBarIcon className="h-7 w-7 text-primary-600" />
                    Employee Report
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Time logged per employee per day with project breakdown. Data from the database.
                </p>
            </div>

            {/* Filters */}
            <div className="card mb-6">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Start date
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="input py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            End date
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="input py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Employee
                        </label>
                        <select
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            className="input py-2 min-w-[180px]"
                        >
                            <option value="">All employees</option>
                            {users.map((u: any) => (
                                <option key={u.id} value={u.id}>
                                    {u.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={downloadCsv}
                        disabled={reportRows.length === 0}
                        className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                        Download CSV
                    </button>
                    {/* Download HTML – commented out for now
                    <button
                        type="button"
                        onClick={downloadHtml}
                        disabled={reportRows.length === 0}
                        className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1"
                    >
                        <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                        Download HTML
                    </button>
                    */}
                </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent" />
                    </div>
                ) : error ? (
                    <div className="p-6 text-center text-red-600 dark:text-red-400">
                        {error.message}
                    </div>
                ) : reportRows.length === 0 ? (
                    <div className="p-12 text-center">
                        <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
                        <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No data</p>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            No time entries found for the selected date range and filters.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Employee
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Email
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Date
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Total time
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        Projects
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                                {reportRows.map((row: any, idx: number) => (
                                    <tr key={`${row.employeeId}-${row.date}-${idx}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                            {row.employeeName ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                            {row.email ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                            {row.date ? format(new Date(row.date), 'MMM d, yyyy') : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                            {formatSeconds(row.totalSeconds ?? 0)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                            {(row.projects ?? []).length === 0 ? (
                                                '—'
                                            ) : (
                                                <ul className="list-disc list-inside space-y-0.5">
                                                    {(row.projects ?? []).map((p: any) => (
                                                        <li key={p.projectId}>
                                                            {p.projectName}: {formatSeconds(p.seconds ?? 0)}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
