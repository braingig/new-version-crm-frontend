'use client';

import { useQuery, useMutation, useApolloClient } from '@apollo/client';
import { GET_ACTIVE_TIME_ENTRY, GET_TODAY_TIMESHEET, GET_TODAY_SESSIONS, GET_TIME_ENTRIES, GET_TIMESHEETS, CHECK_IN, CHECK_OUT, START_TIME_ENTRY, STOP_TIME_ENTRY, GET_PROJECTS, GET_TASKS_FOR_SELECTION, GET_ME, GET_EMPLOYEE_WORK_TYPE, UPDATE_EMPLOYEE_WORK_TYPE, REPORT_ACTIVITY } from '@/lib/graphql/queries';
import { WorkType } from '@/types';
import { useState, useEffect, useCallback, useRef } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { electronService } from '@/services/electronService';
import { browserElectronService } from '@/services/browserElectronService';
import {
    ClockIcon,
    PlayIcon,
    StopIcon,
    PauseIcon,
    CalendarIcon,
    ChartBarIcon,
    DocumentTextIcon,
    UserGroupIcon,
    ArrowTrendingUpIcon,
    ArrowTrendingDownIcon,
    FunnelIcon,
    ArrowDownTrayIcon,
    PlusIcon,
    XMarkIcon,
    CheckCircleIcon,
    ExclamationCircleIcon,
    InformationCircleIcon,
    ComputerDesktopIcon,
    HomeIcon,
    CameraIcon
} from '@heroicons/react/24/outline';

export default function TimeTrackerPage() {
    // State management
    const [elapsed, setElapsed] = useState(0);
    const [displayTime, setDisplayTime] = useState(0);
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedTask, setSelectedTask] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [manualEntry, setManualEntry] = useState({
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        description: '',
        projectId: '',
        taskId: ''
    });
    const [viewMode, setViewMode] = useState<'dashboard' | 'timesheet' | 'reports'>('dashboard');
    type TimesheetFilterValue = 'today' | 'week' | 'month' | 'lastMonth' | 'custom';
    const [timesheetFilter, setTimesheetFilter] = useState<TimesheetFilterValue>('week');
    const [customMonth, setCustomMonth] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [showWorkTypeSelector, setShowWorkTypeSelector] = useState(false);
    const [showOnsiteCheckInToast, setShowOnsiteCheckInToast] = useState(false);
    const [showCheckInSuccessToast, setShowCheckInSuccessToast] = useState(false);
    const [lastActivity, setLastActivity] = useState(Date.now());
    const [isTimerPaused, setIsTimerPaused] = useState(false);
    const pauseStartTimeRef = useRef<number | null>(null); // Use ref instead of state for immediate access
    const [totalWorkingTime, setTotalWorkingTime] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [cachedActiveEntry, setCachedActiveEntry] = useState<any>(null);

    // Persistent cache refs to survive React re-renders
    const persistentCacheRef = useRef<any>(null);
    const cacheInitializedRef = useRef(false);
    const isTimerPausedRef = useRef(false); // Keep current isTimerPaused value for activity listener
    const isPausedRef = useRef(false); // Keep current isPaused value for timer interval
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null); // Store current timer interval
    const actualElapsedRef = useRef(0); // Track actual elapsed time independently of state
    const isUpdatingStateRef = useRef(false); // Prevent rapid state updates
    const [timerRestartKey, setTimerRestartKey] = useState(0); // Force timer restart on resume
    const [isTabVisible, setIsTabVisible] = useState(true);
    const [isStopping, setIsStopping] = useState(false);
    const [timerStatus, setTimerStatus] = useState<'running' | 'paused' | 'idle'>('running');
    const [idleThreshold, setIdleThreshold] = useState(60000); // 1 minute default
    const [showIdleNotification, setShowIdleNotification] = useState(false);
    const [idleStartTime, setIdleStartTime] = useState<number | null>(null);
    const [showIdleSettings, setShowIdleSettings] = useState(false);

    // Electron integration state
    const [isElectron, setIsElectron] = useState(false);
    const [electronTrackingEnabled, setElectronTrackingEnabled] = useState(false);
    const [activityStatus, setActivityStatus] = useState<any>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

    // Simple notification function
    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setNotification({ message, type });
        // Auto-hide after 5 seconds (or 10 seconds for warnings)
        setTimeout(() => {
            setNotification(null);
        }, type === 'warning' ? 10000 : 5000);
    }, []);

    // Screenshot management state
    const [screenshotConsent, setScreenshotConsent] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('screenshotConsent') === 'true';
            console.log('🔍 Initial screenshot consent from localStorage:', stored);
            return stored;
        }
        return false;
    });
    const [screenshotSettings, setScreenshotSettings] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('screenshotSettings');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Force update any settings less than 10 minutes to 10 minutes
                    if (parsed.intervalMinutes < 10) {
                        parsed.intervalMinutes = 10;
                        // Save the corrected settings back to localStorage
                        localStorage.setItem('screenshotSettings', JSON.stringify(parsed));
                    }
                    return parsed;
                } catch (error) {
                    console.error('Failed to parse screenshot settings:', error);
                }
            }
        }
        return {
            enabled: false,
            intervalMinutes: 10, // Capture screenshot every 10 minutes
            randomOffsetMinutes: 1, // Random offset of ±1 minute
            showNotification: true
        };
    });
    const [lastScreenshotTime, setLastScreenshotTime] = useState<number | null>(null);
    const [screenshotHistory, setScreenshotHistory] = useState<Array<{ timestamp: number; data: string; filename: string }>>(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('screenshotHistory');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // Limit history to last 50 screenshots to prevent storage issues
                    return Array.isArray(parsed) ? parsed.slice(-50) : [];
                }
            } catch (error) {
                console.error('Error loading screenshot history:', error);
            }
        }
        return [];
    });
    const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
    const lastScreenshotTimeRef = useRef<number | null>(null);

    // Apollo Client for cache management
    const client = useApolloClient();

    // GraphQL queries
    const { data: meData, error: meError } = useQuery(GET_ME, {
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });

    // Get current user ID for filtering
    const currentUserId = meData?.me?.id;

    // isTimerPausedRef is now updated directly in the state setters for immediate consistency

    // Get employee work type
    const { data: workTypeData, refetch: refetchWorkType } = useQuery(GET_EMPLOYEE_WORK_TYPE, {
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });

    // Get today's sessions for multiple check-ins
    const { data: todaySessionsData, refetch: refetchTodaySessions } = useQuery(GET_TODAY_SESSIONS, {
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });

    const { data: activeEntryData, refetch: refetchActiveEntry, error: activeEntryError } = useQuery(GET_ACTIVE_TIME_ENTRY, {
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });
    const { data: todayTimesheetData, refetch: refetchTodayTimesheet, error: todayTimesheetError } = useQuery(GET_TODAY_TIMESHEET, {
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });
    const { data: timeEntriesData, refetch: refetchTimeEntries, error: timeEntriesError } = useQuery(GET_TIME_ENTRIES, {
        variables: { employeeId: currentUserId },
        skip: !currentUserId,
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });

    // Get tasks assigned to current user (flat: parents + subtasks)
    const { data: myTasksData, error: myTasksError } = useQuery(GET_TASKS_FOR_SELECTION, {
        variables: { filters: { assignedToId: currentUserId } },
        skip: !currentUserId,
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });

    // Get projects that have tasks assigned to current user
    const { data: projectsData, error: projectsError } = useQuery(GET_PROJECTS, {
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });

    // Filter tasks by selected project (flat: parents + subtasks; only when project selected)
    const { data: tasksData, error: tasksError } = useQuery(GET_TASKS_FOR_SELECTION, {
        variables: {
            filters: {
                assignedToId: currentUserId,
                ...(selectedProject && { projectId: selectedProject })
            }
        },
        skip: !currentUserId || !selectedProject,
        fetchPolicy: 'network-only',
        notifyOnNetworkStatusChange: true
    });

    const activeEntry = activeEntryData?.activeTimeEntry;
    const todayTimesheet = todayTimesheetData?.todayTimesheet;
    const todaySessions = todaySessionsData?.todaySessions || [];
    const employeeWorkType = workTypeData?.employeeWorkType || WorkType.REMOTE;
    const allProjects = projectsData?.projects || [];
    const myTasks = myTasksData?.tasksForSelection || [];
    // Initialize persistent cache on component mount
    useEffect(() => {
        if (!cacheInitializedRef.current) {
            // Clear any old sessionStorage cache to avoid conflicts
            try {
                sessionStorage.removeItem('cachedActiveEntry');
            } catch (error) {
                // Ignore errors
            }

            // Try to restore from localStorage (more persistent than sessionStorage)
            try {
                const storedCache = localStorage.getItem('cachedActiveEntry');
                if (storedCache) {
                    const parsedCache = JSON.parse(storedCache);
                    persistentCacheRef.current = parsedCache;
                    console.log('🔄 Restored cache from localStorage:', parsedCache);
                } else {
                    console.log('📭 No cached entry found in localStorage');
                }
            } catch (error) {
                console.error('❌ Error restoring cache:', error);
            }
            cacheInitializedRef.current = true;
        }
    }, []);

    // Simple cache sync - only update localStorage when cache changes (not on mount)
    useEffect(() => {
        // Skip initial mount sync
        if (!cacheInitializedRef.current) return;

        // Update localStorage when cache changes
        try {
            if (cachedActiveEntry) {
                localStorage.setItem('cachedActiveEntry', JSON.stringify(cachedActiveEntry));
                console.log('💾 Saved cache to localStorage');
            } else {
                localStorage.removeItem('cachedActiveEntry');
                console.log('🗑️ Removed cache from localStorage');
            }
        } catch (error) {
            console.error('❌ Error saving cache:', error);
        }

        // Keep ref in sync
        persistentCacheRef.current = cachedActiveEntry;
    }, [cachedActiveEntry]);

    const tasks = tasksData?.tasksForSelection || [];

    // Filter projects to only show those that have tasks assigned to current user
    const myProjectIds = [...new Set(myTasks.map((task: any) => task.projectId))];
    const projects = allProjects.filter((project: any) => myProjectIds.includes(project.id));

    // Create lookup maps for project and task names
    const projectMap = new Map(allProjects.map((project: any) => [project.id, project.name]));
    // Include subtasks: show "Parent › Subtask" for subtasks
    const taskMap = new Map(myTasks.map((t: any) => [t.id, t.parentTask ? `${t.parentTask.title} › ${t.title}` : t.title]));

    // Check if user has any assigned tasks
    const hasAssignedTasks = myTasks.length > 0;

    // Clear selected project when user changes to avoid showing wrong project
    useEffect(() => {
        if (currentUserId) {
            setSelectedProject('');
        }
    }, [currentUserId]);

    // Refetch all time-related data when user changes to ensure data isolation
    useEffect(() => {
        if (currentUserId) {
            refetchActiveEntry();
            refetchTodayTimesheet();
            refetchTimeEntries();
        }
    }, [currentUserId, refetchActiveEntry, refetchTodayTimesheet, refetchTimeEntries]);

    // Calculate date ranges for week and month
    const getWeekStart = () => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        return new Date(now.setDate(diff));
    };

    const getWeekEnd = () => {
        const weekStart = getWeekStart();
        return new Date(weekStart.setDate(weekStart.getDate() + 6));
    };

    const getMonthStart = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    };

    const getMonthEnd = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0);
    };

    const getLastMonthStart = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    };

    const getLastMonthEnd = () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 0);
    };

    const getMonthRangeFor = (yyyyMm: string) => {
        const [y, m] = yyyyMm.split('-').map(Number);
        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 0);
        return { start, end };
    };

    const getPreviousMonthsOptions = () => {
        const options: { value: string; label: string }[] = [];
        const now = new Date();
        for (let i = 0; i < 24; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            options.push({ value, label });
        }
        return options;
    };

    // Queries for week and month timesheets
    // Temporarily disabled to debug 400 errors
    // const { data: weekTimesheetsData, error: weekError } = useQuery(GET_TIMESHEETS, {
    //     variables: {
    //         startDate: getWeekStart().toISOString(),
    //         endDate: getWeekEnd().toISOString()
    //     },
    //     skip: true,
    //     onError: (error) => {
    //         console.error('Week timesheets query error:', error);
    //     }
    // });

    // const { data: monthTimesheetsData, error: monthError } = useQuery(GET_TIMESHEETS, {
    //     variables: {
    //         startDate: getMonthStart().toISOString(),
    //         endDate: getMonthEnd().toISOString()
    //     },
    //     skip: true,
    //     onError: (error) => {
    //         console.error('Month timesheets query error:', error);
    //     }
    // });

    const weekTimesheetsData = null;
    const monthTimesheetsData = null;

    // Mutations
    const [checkIn] = useMutation(CHECK_IN, {
        onCompleted: () => {
            refetchActiveEntry();
            refetchTodayTimesheet();
            refetchTodaySessions();
            setShowCheckInSuccessToast(true);
            setTimeout(() => {
                setShowCheckInSuccessToast(false);
            }, 3000);
        },
        onError: (error) => {
            // Check if it's the onsite employee check-in error
            if (error.message.includes('Onsite employees can only check in once per day')) {
                setShowOnsiteCheckInToast(true);
                setTimeout(() => {
                    setShowOnsiteCheckInToast(false);
                }, 3000);
            }
        },
        update: (cache) => {
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'activeTimeEntry' });
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'todayTimesheet' });
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'todaySessions' });
        }
    });
    const [checkOut] = useMutation(CHECK_OUT, {
        onCompleted: () => {
            refetchActiveEntry();
            refetchTodayTimesheet();
            refetchTodaySessions();
        },
        update: (cache) => {
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'activeTimeEntry' });
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'todayTimesheet' });
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'todaySessions' });
        }
    });
    const [startTimer] = useMutation(START_TIME_ENTRY, {
        onCompleted: async () => {
            console.log('✅ Timer started successfully!');

            // Show system notification for timer start
            try {
                await browserElectronService.showNotification(
                    'Timer Started',
                    'Your timer has been started successfully'
                );
            } catch (error) {
                console.error('Failed to show start notification:', error);
            }

            // Set initial screenshot time when timer starts (to prevent immediate capture)
            if (screenshotSettings.enabled && screenshotConsent) {
                const initialTime = Date.now();
                setLastScreenshotTime(initialTime);
                lastScreenshotTimeRef.current = initialTime;
            }

            // Add delay before refetch to let backend process
            setTimeout(async () => {
                console.log('🔄 Refetching immediately after timer start...');
                const result = await refetchActiveEntry();
                console.log('📊 Post-start refetch data:', JSON.stringify(result.data, null, 2));

                // Cache the active entry for pause/resume logic
                if (result.data?.activeTimeEntry) {
                    console.log('💾 Caching active entry:', result.data.activeTimeEntry);
                    console.log('💾 Cache state BEFORE setCachedActiveEntry:', cachedActiveEntry);
                    setCachedActiveEntry(result.data.activeTimeEntry);
                    console.log('✅ Cache set successfully');
                }
            }, 1000);
            // refetchTimeEntries(); // Removed - causes activeEntry to change and override pause state
            setSelectedProject('');
            setSelectedTask('');
            setTaskDescription('');
        },
        update: (cache) => {
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'activeTimeEntry' });
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'timeEntries' });
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'todayTimesheet' });
        },
        onError: (error) => {
            console.error('Error starting timer:', error);
            alert('Failed to start timer. Please check if the backend is running.');
        }
    });
    const [stopTimer] = useMutation(STOP_TIME_ENTRY, {
        onCompleted: (data) => {
            try {
                console.log('✅ TIMER STOP SUCCESS - Response data:', data);
                console.log('🗑️ Clearing cached entry due to manual timer stop');

                try {
                    browserElectronService.showNotification(
                        'Timer Stopped',
                        `Your timer has been stopped at ${formatTime(totalWorkingTime)}`
                    ).catch((err: unknown) => console.error('Failed to show stop notification:', err));
                } catch (e) {
                    console.error('Failed to show stop notification:', e);
                }

                setCachedActiveEntry(null);
                refetchActiveEntry();
                refetchTimeEntries();
                refetchTodaySessions();
            } finally {
                setIsStopping(false);
            }
        },
        update: (cache) => {
            try {
                console.log('🔄 UPDATING CACHE AFTER STOP');
                cache.evict({ id: 'ROOT_QUERY', fieldName: 'activeTimeEntry' });
                cache.evict({ id: 'ROOT_QUERY', fieldName: 'timeEntries' });
                cache.evict({ id: 'ROOT_QUERY', fieldName: 'todayTimesheet' });
                cache.evict({ id: 'ROOT_QUERY', fieldName: 'todaySessions' });
                cache.evict({ id: 'ROOT_QUERY', fieldName: 'timesheets' });
                cache.evict({ id: 'ROOT_QUERY', fieldName: 'weekTimesheets' });
                cache.evict({ id: 'ROOT_QUERY', fieldName: 'monthTimesheets' });
            } catch (e) {
                console.warn('Cache evict during stop:', e);
            }
        },
        onError: (error) => {
            console.error('❌ TIMER STOP ERROR:', error);
            console.error('❌ ERROR GRAPHQL ERRORS:', error.graphQLErrors);
            console.error('❌ ERROR NETWORK ERROR:', error.networkError);
            console.error('❌ ERROR MESSAGE:', error.message);

            setIsStopping(false); // Reset stopping flag on error

            // Provide more specific error messages
            if (error.message.includes('No active timer found') ||
                error.graphQLErrors?.some((gqlError: any) => gqlError.message?.includes('No active timer found'))) {
                console.log('❌ DETECTED "No active timer found" error');
                // This is not really an error - the timer was already stopped
                // Just refresh the UI to reflect the correct state
                refetchActiveEntry();
                refetchTimeEntries();
                refetchTodaySessions();
                setCachedActiveEntry(null);
                // Only show alert if it's unexpected (i.e., we thought there was an active timer)
                const currentActiveEntry = activeEntry || persistentCacheRef.current || cachedActiveEntry;
                if (currentActiveEntry) {
                    console.log('⚠️ UI thought there was an active timer, but backend says none');
                    // Don't show alarming error message, just refresh silently
                    console.log('🔄 Silently refreshing UI state to match backend');
                }
            } else if (error.message.includes('Network error') || error.networkError) {
                console.log('❌ DETECTED Network error');
                alert('Network error: Failed to stop timer. Please check your connection.');
                // Refetch in case stop actually succeeded but response was lost
                refetchActiveEntry();
            } else {
                console.log('❌ OTHER ERROR TYPE');
                alert(`Failed to stop timer: ${error.message}`);
            }
        }
    });

    const [updateWorkType] = useMutation(UPDATE_EMPLOYEE_WORK_TYPE, {
        onCompleted: () => {
            refetchWorkType();
            refetchTodaySessions();
            setShowWorkTypeSelector(false);
        },
        update: (cache) => {
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'employeeWorkType' });
            cache.evict({ id: 'ROOT_QUERY', fieldName: 'todaySessions' });
        }
    });

    const [reportActivity] = useMutation(REPORT_ACTIVITY, {
        onError: (error) => {
            console.error('Error reporting activity:', error);
        }
    });

    // Electron initialization and integration
    useEffect(() => {
        const isRunningInElectron = electronService.isRunningInElectron;
        setIsElectron(isRunningInElectron);

        // Only initialize tracking if we have a user ID AND an active timer
        // This ensures idle notifications only appear when the timer is actually running
        if (currentUserId && activeEntry?.id) {
            if (!electronTrackingEnabled) {
                console.log('✅ Active timer detected - starting Electron activity tracking');
                // Initialize Electron activity tracking (will try browser service first, then IPC)
                initializeElectronTracking();
            }
        } else {
            // Stop tracking if it was enabled but activeEntry is gone
            if (electronTrackingEnabled) {
                console.log('🛑 No active timer - stopping Electron activity tracking');
                setElectronTrackingEnabled(false);
                // Note: Actual service stopping is handled by the effect watching electronTrackingEnabled
            }
        }

        return () => {
            // Cleanup Electron listeners on unmount
            if (isRunningInElectron) {
                electronService.removeActivityStatusListener();
            }

            // Stop browser electron service if it was active
            if (browserElectronService.isServiceAvailable && electronTrackingEnabled) {
                browserElectronService.stopActivityTracking();
            }
        };
    }, [currentUserId, activeEntry?.id, electronTrackingEnabled]);

    const initializeElectronTracking = async () => {
        console.log('🔧 Initializing Electron tracking...');

        if (!currentUserId) {
            console.error('❌ No user ID — cannot start tracking');
            return;
        }

        // First, try to get auth token
        const token = localStorage.getItem('accessToken') || '';
        if (!token) {
            console.warn('⚠️ No auth token available — cannot start tracking');
            return;
        }

        console.log('🔍 Checking browser Electron service availability...');

        // Try browser service first (for web-based Electron service)
        try {
            await browserElectronService.forceCheckAvailability();
            if (browserElectronService.isServiceAvailable) {
                console.log('🌐 Using browser Electron service for activity tracking');
                const result = await browserElectronService.startActivityTracking(currentUserId, token);
                if (result.success) {
                    setElectronTrackingEnabled(true);
                    console.log('✅ Browser Electron tracking started successfully');
                    return;
                } else {
                    console.warn('⚠️ Browser Electron service failed to start tracking');
                }
            } else {
                console.log('🌐 Browser Electron service not available');
            }
        } catch (error) {
            console.warn('⚠️ Browser Electron service error:', error instanceof Error ? error.message : String(error));
        }

        console.log('🔍 Checking native Electron API...');

        // Fallback to native Electron IPC
        if ((window as any).electron) {
            console.log('🖥️ Using native Electron IPC for activity tracking');
            try {
                const result = await electronService.startActivityTracking(currentUserId);
                if (result) {
                    setElectronTrackingEnabled(true);
                    console.log('✅ Native Electron tracking started successfully');
                    return;
                } else {
                    console.warn('⚠️ Native Electron tracking failed to start');
                }
            } catch (error) {
                console.error('❌ Failed to start native Electron tracking:', error);
            }
        } else {
            console.log('🖥️ Native Electron API not available');
        }

        console.warn('⚠️ Electron not available in this environment');
        setElectronTrackingEnabled(false);
    };



    // Stop Electron tracking when component unmounts or user logs out
    useEffect(() => {
        return () => {
            if (electronTrackingEnabled) {
                // Try browser service first
                if (browserElectronService.isServiceAvailable) {
                    browserElectronService.stopActivityTracking();
                }
                // Fallback to IPC service
                electronService.stopActivityTracking();
            }
        };
    }, [electronTrackingEnabled]);

    // Error handling effects
    useEffect(() => {
        if (activeEntryError) {
            console.error('Active entry error:', activeEntryError);
        }
    }, [activeEntryError]);

    useEffect(() => {
        if (todayTimesheetError) {
            console.error('Today timesheet error:', todayTimesheetError);
        }
    }, [todayTimesheetError]);

    useEffect(() => {
        if (timeEntriesError) {
            console.error('Time entries error:', timeEntriesError);
        }
    }, [timeEntriesError]);

    // Effect to persist screenshot consent and settings
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('screenshotConsent', screenshotConsent.toString());
        }
    }, [screenshotConsent]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('screenshotSettings', JSON.stringify(screenshotSettings));
        }
    }, [screenshotSettings]);

    // Effect to persist screenshot history to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined' && screenshotHistory.length > 0) {
            try {
                // Limit to last 50 screenshots to prevent storage issues
                const limitedHistory = screenshotHistory.slice(-50);
                localStorage.setItem('screenshotHistory', JSON.stringify(limitedHistory));
            } catch (error) {
                console.error('Error saving screenshot history:', error);
                // If storage is full, clear older entries
                try {
                    const reducedHistory = screenshotHistory.slice(-20);
                    localStorage.setItem('screenshotHistory', JSON.stringify(reducedHistory));
                } catch (error2) {
                    console.error('Error saving reduced screenshot history:', error2);
                    localStorage.removeItem('screenshotHistory');
                }
            }
        }
    }, [screenshotHistory]);

    // Sync display time with actual elapsed ref
    useEffect(() => {
        const interval = setInterval(() => {
            setDisplayTime(actualElapsedRef.current);
        }, 100); // Update every 100ms for smooth display

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (projectsError) {
            console.error('Projects error:', projectsError);
        }
    }, [projectsError]);

    useEffect(() => {
        if (tasksError) {
            console.error('Tasks error:', tasksError);
        }
    }, [tasksError]);

    // Initialize timer when active entry starts
    useEffect(() => {
        console.log('🔄 Active entry effect RUNNING - activeEntry.id:', activeEntry?.id, 'isTimerPaused:', isTimerPaused);
        if (activeEntry) {
            // Check if this is actually a new entry (different from cached)
            const currentCache = persistentCacheRef.current;
            const isNewEntry = !currentCache || currentCache.id !== activeEntry.id;

            console.log('🔄 Active entry effect - isNewEntry:', isNewEntry, 'currentIsPaused:', isTimerPaused);
            console.log('🔄 Active entry effect STATE - totalWorkingTime:', totalWorkingTime, 'elapsed:', elapsed);

            if (isNewEntry) {
                // New active entry started, reset working time state only if we don't have existing working time
                if (totalWorkingTime === 0 && elapsed === 0) {
                    console.log('🆕 New timer entry detected, resetting state');
                    setTotalWorkingTime(0);
                    setElapsed(0);
                    setIsPaused(false);
                    setIsTimerPaused(false);
                    pauseStartTimeRef.current = null;
                    setIsStopping(false); // Reset stopping flag for new timer
                    // Initialize refs
                    isPausedRef.current = false;
                    isTimerPausedRef.current = false;
                    actualElapsedRef.current = 0; // Reset persistent elapsed ref
                    console.log('🆕 New timer initialized - isPausedRef:', isPausedRef.current, 'isTimerPausedRef:', isTimerPausedRef.current);
                } else {
                    console.log('🔄 Existing entry with working time, preserving state');
                    // Preserve existing working time
                }
            } else {
                // Same entry, don't reset pause state
                console.log('🔄 Same timer entry detected, preserving pause state');
            }
        } else {
            // Reset when no active entry, but don't interfere with ongoing stop process
            // Only reset if we have working time to clear (prevent unnecessary resets)
            if (totalWorkingTime > 0 || elapsed > 0) {
                console.log('🚫 No active entry, resetting timer state (preserving isStopping flag)');
                console.log('🚨 RESET TRIGGERED - setting totalWorkingTime and elapsed to 0');
                setTotalWorkingTime(0);
                setElapsed(0);
                setIsPaused(false);
                pauseStartTimeRef.current = null;
                setIsTimerPaused(false);
                actualElapsedRef.current = 0; // Reset persistent elapsed ref
                // Don't reset isStopping here - let the stop mutation handlers manage it
            } else {
                console.log('🚫 No active entry and no working time, state already clean');
            }
        }
    }, [activeEntry?.id]); // Only re-run when active entry ID changes

    // Timer pause/resume logic is now handled directly in handleTimerPause and handleTimerResume functions

    // Page visibility detection - tracks when user returns to browser tab
    // useEffect(() => {
    //     if (!activeEntry) return;

    //     const handleVisibilityChange = () => {
    //         const isVisible = !document.hidden;
    //         setIsTabVisible(isVisible);

    //         // When user returns to the tab, treat it as activity and resume timer
    //         if (isVisible) {
    //             const now = Date.now();
    //             setLastActivity(now);
    //             if (isTimerPaused) {
    //                 setIsTimerPaused(false);
    //             }
    //         }
    //     };

    //     // Listen for page visibility changes (tab switching, minimizing browser)
    //     document.addEventListener('visibilitychange', handleVisibilityChange);

    //     // Also listen for window focus/blur events (switching between browser windows)
    //     const handleFocus = () => {
    //         const now = Date.now();
    //         setIsTabVisible(true);
    //         setLastActivity(now);
    //         if (isTimerPaused) {
    //             setIsTimerPaused(false);
    //         }
    //     };

    //     const handleBlur = () => {
    //         setIsTabVisible(false);
    //     };

    //     window.addEventListener('focus', handleFocus);
    //     window.addEventListener('blur', handleBlur);

    //     return () => {
    //         document.removeEventListener('visibilitychange', handleVisibilityChange);
    //         window.removeEventListener('focus', handleFocus);
    //         window.removeEventListener('blur', handleBlur);
    //     };
    // }, [activeEntry, isTimerPaused]);

    // Enhanced user activity detection - comprehensive activity monitoring
    // useEffect(() => {
    //     if (!activeEntry) return;

    //     let activityTimeout: NodeJS.Timeout;
    //     let lastActivityTime = Date.now();

    //     const handleActivity = (event: Event) => {
    //         const now = Date.now();

    //         // Ignore duplicate events within 100ms to improve performance
    //         if (now - lastActivityTime < 100) return;
    //         lastActivityTime = now;

    //         // Clear any pending activity timeout
    //         if (activityTimeout) {
    //             clearTimeout(activityTimeout);
    //         }

    //         // Debounce activity updates to prevent too frequent calls
    //         activityTimeout = setTimeout(() => {
    //             setLastActivity(now);
    //             setIdleStartTime(null); // Reset idle start time on activity

    //             // Update timer status and auto-resume if it was paused due to inactivity
    //             if (isTimerPaused && timerStatus === 'idle') {
    //                 setIsTimerPaused(false);
    //                 setTimerStatus('running');
    //                 setShowIdleNotification(false);
    //             }
    //         }, 50); // Reduced debounce for better responsiveness
    //     };

    //     // Comprehensive user activity events
    //     const events = [
    //         // Mouse events
    //         'mousemove', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu',
    //         // Keyboard events  
    //         'keypress', 'keydown', 'keyup',
    //         // Touch events for mobile devices
    //         'touchstart', 'touchend', 'touchmove', 'touchcancel',
    //         // Scroll and wheel events
    //         'scroll', 'wheel',
    //         // Form interactions
    //         'input', 'change', 'focus', 'blur',
    //         // Drag and drop
    //         'dragstart', 'dragend', 'drop',
    //         // Additional events for better detection
    //         'pointerdown', 'pointerup', 'pointermove',
    //         'select', 'selectstart', 'selectionchange',
    //         'copy', 'paste', 'cut'
    //     ];

    //     // Add event listeners with capture for better detection
    //     events.forEach(event => {
    //         document.addEventListener(event, handleActivity, { 
    //             capture: true, 
    //             passive: true 
    //         });
    //     });

    //     // Also monitor window-level events
    //     const handleWindowActivity = () => handleActivity(new Event('window'));
    //     window.addEventListener('resize', handleWindowActivity, { passive: true });
    //     window.addEventListener('orientationchange', handleWindowActivity, { passive: true });

    //     return () => {
    //         // Clear activity timeout
    //         if (activityTimeout) {
    //             clearTimeout(activityTimeout);
    //         }

    //         // Remove all event listeners
    //         events.forEach(event => {
    //             document.removeEventListener(event, handleActivity, true);
    //         });
    //         window.removeEventListener('resize', handleWindowActivity);
    //         window.removeEventListener('orientationchange', handleWindowActivity);
    //     };
    // }, [activeEntry, isTimerPaused, timerStatus]);

    // Enhanced idle time detection with configurable threshold and smart notifications
    // useEffect(() => {
    //     if (!activeEntry) return;

    //     const inactivityCheck = setInterval(() => {
    //         const now = Date.now();
    //         const inactiveTime = now - lastActivity;

    //         // Check if user has been inactive for the threshold period
    //         if (inactiveTime >= idleThreshold && !isTimerPaused) {
    //             // Mark as idle and pause timer
    //             setIsTimerPaused(true);
    //             setTimerStatus('idle');
    //             setIdleStartTime(now);
    //             setPauseStartTime(now);
    //             setShowIdleNotification(true);
    //         }

    //         // Auto-hide idle notification after 10 seconds
    //         if (showIdleNotification && inactiveTime >= idleThreshold + 10000) {
    //             setShowIdleNotification(false);
    //         }
    //     }, 1000); // Check every second

    //     return () => clearInterval(inactivityCheck);
    // }, [activeEntry, lastActivity, isTimerPaused, idleThreshold, showIdleNotification]);

    // Fallback idle detection removed - Electron service handles all idle detection

    // Enhanced timer effect - tracks actual working time without idle periods
    useEffect(() => {
        // Use persistent cache reference to avoid React re-mount issues
        const timerEntry = activeEntry || persistentCacheRef.current || cachedActiveEntry;



        // Clear any existing interval first
        if (timerIntervalRef.current) {

            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        if (timerEntry && !isTimerPausedRef.current && timerStatus === 'running') {
            // Timer is running - update every second

            console.log('⏱️ Timer conditions met - timerEntry:', !!timerEntry, 'isTimerPausedRef:', isTimerPausedRef.current, 'timerStatus:', timerStatus, 'isPausedRef:', isPausedRef.current);
            console.log('⏱️ State vs Ref - isTimerPaused(state):', isTimerPaused, 'isPaused(state):', isPaused);
            console.log('⏱️ Current totalWorkingTime:', totalWorkingTime, 'actualElapsedRef.current:', actualElapsedRef.current);

            const intervalId = Date.now();
            console.log('⏱️ Creating new timer interval:', intervalId);

            // CRITICAL: Clear any existing timer interval before creating a new one
            if (timerIntervalRef.current) {
                console.log('🛑 CLEANUP: Found existing timer interval, clearing it first');
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }

            // CRITICAL: Use the ref value instead of state to get the most up-to-date working time
            // This prevents the timer from using stale state after resume corrections
            const currentWorkingTime = actualElapsedRef.current;
            const startTime = Date.now() - (currentWorkingTime * 1000);
            console.log('⏱️ Timer starting/resuming - baseWorkingTime (from ref):', currentWorkingTime, 'seconds, calculated startTime:', startTime, 'currentTime:', Date.now());
            console.log('⏱️ State vs Ref - totalWorkingTime(state):', totalWorkingTime, 'actualElapsedRef:', actualElapsedRef.current);
            console.log('🔍 TIMER START DEBUG - If user worked 44s, baseWorkingTime should be 44, not 104. Checking...');

            timerIntervalRef.current = setInterval(() => {
                // CRITICAL: Check both refs to ensure timer stops immediately when user becomes inactive
                if (isPausedRef.current || isTimerPausedRef.current) {
                    console.log('🛑 Timer interval detected pause - stopping immediately');
                    if (timerIntervalRef.current) {
                        clearInterval(timerIntervalRef.current);
                        timerIntervalRef.current = null;
                    }
                    return;
                }

                // Calculate elapsed time based on start time (more reliable than incremental updates)
                const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
                actualElapsedRef.current = currentElapsed; // Update ref immediately

                setTotalWorkingTime(currentElapsed);
                setElapsed(currentElapsed);

                // Debug logging to verify correct calculation
                if (currentElapsed % 5 === 0) {
                    const debugIdleTime = pauseStartTimeRef.current ? Math.floor((Date.now() - pauseStartTimeRef.current) / 1000) : 0;
                    console.log('🔍 TIMER DEBUG - currentElapsed:', currentElapsed, 'startTime:', startTime, 'idleTime:', debugIdleTime, 'isTimerPausedRef:', isTimerPausedRef.current);
                }

                // Log every 5 seconds to reduce spam
                if (currentElapsed % 5 === 0) {
                    console.log('⏱️ Timer working (ref-based):', currentElapsed, 'seconds elapsed (ref:', actualElapsedRef.current, ')');
                }



                if (screenshotSettings.enabled && screenshotConsent) {
                    const now = Date.now();
                    const intervalMs = screenshotSettings.intervalMinutes * 60 * 1000;
                    const offsetMs = (Math.random() * 2 - 1) * screenshotSettings.randomOffsetMinutes * 60 * 1000;
                    const effectiveInterval = intervalMs + offsetMs;
                    // Use ref for immediate timestamp checking to avoid race conditions
                    const lastScreenshotTimeImmediate = lastScreenshotTimeRef.current || lastScreenshotTime;
                    const timeSinceLast = lastScreenshotTimeImmediate ? now - lastScreenshotTimeImmediate : 0;



                    // Only trigger if enough time has passed since last screenshot and we're not already capturing
                    // For first time (no previous screenshot), trigger after 10 minutes from timer start
                    const shouldTrigger = lastScreenshotTimeImmediate
                        ? timeSinceLast >= effectiveInterval
                        : currentElapsed >= effectiveInterval / 1000; // Convert to seconds for comparison

                    // Debug logging every 30 seconds to track screenshot timing
                    if (currentElapsed % 30 === 0) {
                        const minutesElapsed = (currentElapsed / 60).toFixed(1);
                        const intervalMinutes = (effectiveInterval / 1000 / 60).toFixed(1);
                        const timeSinceLastMinutes = lastScreenshotTimeImmediate ? (timeSinceLast / 1000 / 60).toFixed(1) : 'N/A';
                        console.log(`📸 Screenshot Check - Elapsed: ${minutesElapsed}min, Interval: ${intervalMinutes}min, Since last: ${timeSinceLastMinutes}min, Should trigger: ${shouldTrigger}`);
                    }

                    if (shouldTrigger && !isCapturingScreenshot) {
                        console.log('📸 Screenshot captured (10 min interval)');

                        // Update lastScreenshotTime immediately to prevent multiple triggers
                        const triggerTime = Date.now();
                        setLastScreenshotTime(triggerTime);
                        lastScreenshotTimeRef.current = triggerTime; // Immediate ref update

                        captureScreenForTracking();
                    } else if (isCapturingScreenshot) {
                        // Keep this warning as it's useful for debugging
                        if (currentElapsed % 60 === 0) { // Log every minute only
                            console.log('⏸️ Screenshot capture in progress - skipping');
                        }
                    }
                }
            }, 1000); // Update every second for consistency and performance

            return () => {
                if (timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
            };
        } else if (timerEntry && (isTimerPausedRef.current || timerStatus === 'idle')) {
            // Timer is paused or idle - FREEZE the display time, DO NOT update

            // Do NOT update elapsed time - keep it frozen at the pause moment
        }
    }, [activeEntry?.id, timerRestartKey]);

    // Stop timer when user closes browser window or navigates away
    // useEffect(() => {
    //     if (!activeEntry) return;

    //     const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    //         // Use fetch with keepalive to stop timer reliably during page unload
    //         const token = localStorage.getItem('accessToken');
    //         if (token && activeEntry?.id && !isStopping) {
    //             setIsStopping(true);
    //             const data = JSON.stringify({
    //                 query: `
    //                     mutation StopTimeEntry {
    //                         stopTimeEntry {
    //                             id
    //                             startTime
    //                             endTime
    //                             duration
    //                             description
    //                             taskId
    //                             employeeId
    //                             isManual
    //                             createdAt
    //                         }
    //                     }
    //                 `
    //             });

    //             // Use fetch with keepalive for reliable delivery during page unload
    //             const graphqlEndpoint = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    //             fetch(graphqlEndpoint, {
    //                 method: 'POST',
    //                 headers: {
    //                     'Content-Type': 'application/json',
    //                     'Authorization': `Bearer ${token}`
    //                 },
    //                 body: data,
    //                 keepalive: true // Ensures request completes even when page is unloading
    //             }).catch(() => {
    //                 // Silently ignore errors during unload
    //             });
    //         }
    //         // No browser alert - just silently stop timer in background
    //     };

    //     // Handle pagehide event as additional fallback for browser close
    //     const handlePageHide = (e: PageTransitionEvent) => {
    //         const token = localStorage.getItem('accessToken');
    //         if (token && activeEntry?.id && !isStopping) {
    //             setIsStopping(true);
    //             const data = JSON.stringify({
    //                 query: `
    //                     mutation StopTimeEntry {
    //                         stopTimeEntry {
    //                             id
    //                             startTime
    //                             endTime
    //                             duration
    //                             description
    //                             taskId
    //                             employeeId
    //                             isManual
    //                             createdAt
    //                         }
    //                     }
    //                 `
    //             });

    //             const graphqlEndpoint = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql';
    //             fetch(graphqlEndpoint, {
    //                 method: 'POST',
    //                 headers: {
    //                     'Content-Type': 'application/json',
    //                     'Authorization': `Bearer ${token}`
    //                 },
    //                 body: data,
    //                 keepalive: true
    //             }).catch(() => {
    //                 // Silently ignore errors during page hide
    //             });
    //         }
    //     };

    //     window.addEventListener('beforeunload', handleBeforeUnload);
    //     window.addEventListener('pagehide', handlePageHide);

    //     return () => {
    //         window.removeEventListener('beforeunload', handleBeforeUnload);
    //         window.removeEventListener('pagehide', handlePageHide);
    //     };
    // }, [activeEntry, stopTimer]);

    // Utility functions
    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTimeFromDate = (date: Date | string | null | undefined) => {
        if (!date) return '--:--';
        const d = new Date(date);
        return d.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    };

    const formatDate = (date: Date | string | null | undefined) => {
        if (!date) return '--';
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    // Screenshot capture function with consent management
    const captureScreenForTracking = async () => {
        console.log('📸 captureScreenForTracking called - consent:', screenshotConsent, 'enabled:', screenshotSettings.enabled);

        if (!screenshotConsent) {
            console.warn('Screenshot capture requires consent');
            return false;
        }

        if (!screenshotSettings.enabled) {
            console.warn('Screenshot capture not enabled');
            return false;
        }

        // Prevent multiple simultaneous captures
        if (isCapturingScreenshot) {
            console.log('⏸️ Already capturing screenshot - ignoring request');
            return false;
        }

        // Set capturing flag to prevent multiple simultaneous captures
        setIsCapturingScreenshot(true);

        try {
            let result: {
                success: boolean;
                filepath?: string | undefined;
                filename?: string | undefined;
                timestamp?: string | undefined;
                size?: number | undefined;
                data?: string | undefined;
                error?: string | undefined;
            } | null = null;

            // Use direct IPC if running in Electron, otherwise use HTTP service
            if (electronService.isRunningInElectron) {
                console.log('🖥️ Using Electron IPC for screenshot capture');
                result = await electronService.captureScreen(true);
            } else {
                console.log('🌐 Using HTTP service for screenshot capture');
                // Check if Electron service is available
                if (!await browserElectronService.isElectronAvailable()) {
                    showNotification('⚠️ Electron server is not running', 'warning');
                    return false;
                }
                result = await browserElectronService.captureScreenshot(true);
            }

            console.log('🔍 captureScreenshot result:', result);

            if (result && result.success && result.filename) {
                const timestamp = Date.now();
                // Note: lastScreenshotTime is already set when trigger was called

                // Add to screenshot history with base64 data
                if (result.data && result.filename) {
                    setScreenshotHistory(prev => [
                        {
                            timestamp,
                            data: result.data as string,
                            filename: result.filename as string
                        },
                        ...prev.slice(0, 11) // Keep only last 12 screenshots
                    ]);
                }

                console.log('✅ Screenshot captured for time tracking:', result.filename);
                showNotification('📸 Screenshot captured successfully', 'success');
                setIsCapturingScreenshot(false);
                return true;
            } else {
                console.error('Screenshot capture failed:', result?.error || 'Unknown error');

                // Show user-friendly error for Electron connection issues
                if (result?.error?.includes('Electron desktop app is not running')) {
                    showNotification(
                        '⚠️ Electron desktop app is not running. Please start the app to enable screenshots.',
                        'warning'
                    );
                } else {
                    showNotification(`Screenshot capture failed: ${result?.error || 'Unknown error'}`, 'error');
                }
                setIsCapturingScreenshot(false);
                return false;
            }
        } catch (error) {
            console.error('❌ Failed to capture screenshot for time tracking:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('Electron service not available')) {
                showNotification('⚠️ Electron server is not running', 'warning');
            } else {
                showNotification('❌ Failed to capture screenshot for time tracking', 'error');
            }
            return false;
        } finally {
            // Always clear the capturing flag
            setIsCapturingScreenshot(false);
        }
    };



    const formatDuration = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    };

    // Duration is always stored in seconds (backend stores duration in seconds).
    const calculateEntryDuration = (entry: any) => {
        if (entry.duration != null && entry.endTime) {
            return formatDuration(entry.duration);
        }

        const start = new Date(entry.startTime);
        const end = entry.endTime ? new Date(entry.endTime) : new Date();
        const durationInSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
        return formatDuration(durationInSeconds);
    };

    const getAttendanceStatus = () => {
        const activeSession = todaySessions.find((session: any) => session.checkIn && !session.checkOut);

        if (activeSession) {
            return { status: 'Checked In', color: 'green', text: 'Active', icon: CheckCircleIcon };
        }

        const hasCompletedSessions = todaySessions.some((session: any) => session.checkIn && session.checkOut);
        if (hasCompletedSessions) {
            return { status: 'Completed', color: 'blue', text: 'Done', icon: CheckCircleIcon };
        }

        return { status: 'Not Checked In', color: 'yellow', text: 'Pending', icon: ExclamationCircleIcon };
    };

    const attendanceStatus = getAttendanceStatus();

    // Calculate time functions
    const getTodayTotalTime = () => {
        let totalSeconds = 0;

        if (todayTimesheet?.totalHours) {
            // totalSeconds += todayTimesheet.totalHours * 3600; // Removed to avoid double counting with time entries
        }

        const todayTimeEntries = timeEntriesData?.timeEntries?.filter((entry: any) => {
            const entryDate = new Date(entry.startTime).toDateString();
            const today = new Date().toDateString();
            return entryDate === today;
        }) || [];

        todayTimeEntries.forEach((entry: any) => {
            if (entry.duration != null) {
                totalSeconds += entry.duration;
            }
        });

        if (activeEntry) {
            totalSeconds += elapsed;
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        return `${hours}h ${minutes}m`;
    };

    const getWeekTotalTime = () => {
        let totalSeconds = 0;

        const weekTimesheets = (weekTimesheetsData as any)?.timesheets || [];
        weekTimesheets.forEach((timesheet: any) => {
            if (timesheet.totalHours) {
                // totalSeconds += timesheet.totalHours * 3600; // Removed to avoid double counting
            }
        });

        const weekTimeEntries = timeEntriesData?.timeEntries?.filter((entry: any) => {
            const entryDate = new Date(entry.startTime);
            const weekStart = getWeekStart();
            const weekEnd = getWeekEnd();
            return entryDate >= weekStart && entryDate <= weekEnd;
        }) || [];

        weekTimeEntries.forEach((entry: any) => {
            if (entry.duration != null) {
                totalSeconds += entry.duration;
            }
        });

        if (activeEntry) {
            const entryDate = new Date(activeEntry.startTime);
            const weekStart = getWeekStart();
            const weekEnd = getWeekEnd();
            if (entryDate >= weekStart && entryDate <= weekEnd) {
                totalSeconds += elapsed;
            }
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        return `${hours}h ${minutes}m`;
    };

    const getMonthTotalTime = () => {
        let totalSeconds = 0;

        const monthTimesheets = (monthTimesheetsData as any)?.timesheets || [];
        monthTimesheets.forEach((timesheet: any) => {
            if (timesheet.totalHours) {
                // totalSeconds += timesheet.totalHours * 3600; // Removed to avoid double counting
            }
        });

        const monthTimeEntries = timeEntriesData?.timeEntries?.filter((entry: any) => {
            const entryDate = new Date(entry.startTime);
            const monthStart = getMonthStart();
            const monthEnd = getMonthEnd();
            return entryDate >= monthStart && entryDate <= monthEnd;
        }) || [];

        monthTimeEntries.forEach((entry: any) => {
            if (entry.duration != null) {
                totalSeconds += entry.duration;
            }
        });

        if (activeEntry) {
            const entryDate = new Date(activeEntry.startTime);
            const monthStart = getMonthStart();
            const monthEnd = getMonthEnd();
            if (entryDate >= monthStart && entryDate <= monthEnd) {
                totalSeconds += elapsed;
            }
        }

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        return `${hours}h ${minutes}m`;
    };

    const getFilteredTimeEntries = () => {
        const entries = timeEntriesData?.timeEntries || [];
        const now = new Date();

        switch (timesheetFilter) {
            case 'today':
                return entries.filter((entry: any) => {
                    const entryDate = new Date(entry.startTime);
                    return entryDate.toDateString() === now.toDateString();
                });
            case 'week': {
                const weekStart = getWeekStart();
                const weekEnd = getWeekEnd();
                return entries.filter((entry: any) => {
                    const entryDate = new Date(entry.startTime);
                    return entryDate >= weekStart && entryDate <= weekEnd;
                });
            }
            case 'month': {
                const monthStart = getMonthStart();
                const monthEnd = getMonthEnd();
                return entries.filter((entry: any) => {
                    const entryDate = new Date(entry.startTime);
                    return entryDate >= monthStart && entryDate <= monthEnd;
                });
            }
            case 'lastMonth': {
                const lastMonthStart = getLastMonthStart();
                const lastMonthEnd = getLastMonthEnd();
                return entries.filter((entry: any) => {
                    const entryDate = new Date(entry.startTime);
                    return entryDate >= lastMonthStart && entryDate <= lastMonthEnd;
                });
            }
            case 'custom': {
                const { start, end } = getMonthRangeFor(customMonth);
                return entries.filter((entry: any) => {
                    const entryDate = new Date(entry.startTime);
                    return entryDate >= start && entryDate <= end;
                });
            }
            default:
                return entries;
        }
    };

    const handleStartTimer = () => {
        console.log('🚀 handleStartTimer called!');

        // Check if mutation is available
        if (!startTimer) {
            console.error('❌ startTimer mutation not available');
            alert('Timer functionality is not available. Please check if the backend is running.');
            return;
        }

        // If user has assigned tasks, require task selection
        if (hasAssignedTasks && !selectedTask) {
            alert('Please select a task before starting the timer');
            return;
        }

        // If user has no assigned tasks, require description
        if (!hasAssignedTasks && !taskDescription.trim()) {
            alert('Please describe what you are working on before starting the timer');
            return;
        }

        // Set timer status to running when starting
        setTimerStatus('running');

        startTimer({
            variables: {
                input: {
                    taskId: selectedTask || null, // Allow null when no tasks assigned
                    description: taskDescription.trim() || `Working on ${getProjectName(selectedProject)}`
                }
            }
        });
    };

    const handleTimerPause = () => {
        // Use persistent cache reference to avoid React re-mount issues
        const currentEntry = persistentCacheRef.current || cachedActiveEntry;
        console.log('🔴 handleTimerPause called - currentEntry:', !!currentEntry, 'cachedActiveEntry:', !!cachedActiveEntry, 'persistentCacheRef:', !!persistentCacheRef.current);

        if (!currentEntry) {
            console.log('🔴 Cannot pause - no cached active entry');
            return;
        }

        // Prevent rapid state updates
        if (isUpdatingStateRef.current || isTimerPausedRef.current) {
            console.log('🔴 Ignoring pause - already updating or already paused');
            return;
        }

        console.log('🔴 Electron idle detection - proceeding with pause');

        isUpdatingStateRef.current = true;

        // Show system notification for timer pause
        try {
            browserElectronService.showNotification(
                'Timer Paused',
                `Your timer has been paused at ${formatTime(totalWorkingTime)}`
            ).catch(error => {
                console.error('Failed to show pause notification:', error);
            });
        } catch (error) {
            console.error('Failed to show pause notification:', error);
        }

        console.log('🔴 Pausing timer due to inactivity. cachedEntry:', currentEntry);
        console.log('🔴 Timer entry details:', {
            id: currentEntry.id,
            startTime: currentEntry.startTime,
            endTime: currentEntry.endTime,
            duration: currentEntry.duration
        });
        console.log('🔴 About to set isTimerPaused to true (current value: false )');
        console.log('🔴 STATE BEFORE PAUSE - elapsed:', elapsed, 'totalWorkingTime:', totalWorkingTime, 'isPaused:', isPaused, 'actualElapsedRef:', actualElapsedRef.current);
        console.log('🔴 EXPECTED: Timer should show 00:44 but user reports it shows 1:44 - investigating time calculation');

        // Force clear any running timer interval immediately
        if (timerIntervalRef.current) {
            console.log('🔴 Force clearing timer interval during pause - was interval running?');
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        } else {
            console.log('🔴 No timer interval to clear during pause');
        }

        // Update refs immediately for consistency
        isTimerPausedRef.current = true;
        isPausedRef.current = true;

        // Store the current elapsed time at pause moment and SYNC state with ref
        const currentRefTime = actualElapsedRef.current;
        console.log('🔴 Freezing elapsed time at:', elapsed, 'totalWorkingTime:', totalWorkingTime, 'syncing from ref:', currentRefTime);

        // Use unstable_batchedUpdates to ensure all state changes happen together
        unstable_batchedUpdates(() => {
            // IMPORTANT: Sync state with ref to preserve the actual working time at pause moment
            setTotalWorkingTime(currentRefTime);
            setElapsed(currentRefTime);
            // Set paused state - working time is now synchronized
            setIsPaused(true);
            setIsTimerPaused(true);
            setTimerStatus('idle');
            const now = Date.now();
            pauseStartTimeRef.current = now;
            setShowIdleNotification(true);
            console.log('🔴 PAUSE START TIME SET:', now, '- BATCHED STATE UPDATE COMPLETED - timer paused at synced time:', currentRefTime, '(was state: elapsed:', elapsed, 'totalWorkingTime:', totalWorkingTime, ')');
        });

        console.log('🔴 PAUSE STATE SET - isTimerPaused should now be true');

        // Reset the updating flag immediately
        isUpdatingStateRef.current = false;
    };

    const handleTimerResume = (electronIdleTime: number = 0) => {
        // Use persistent cache reference to avoid React re-mount issues
        const currentEntry = persistentCacheRef.current || cachedActiveEntry;
        if (!currentEntry) {
            console.log('🟢 Cannot resume - no cached active entry');
            return;
        }

        // Prevent rapid state updates
        if (isUpdatingStateRef.current || !isTimerPausedRef.current) {
            console.log('🟢 Ignoring resume - already updating or not paused');
            return;
        }

        // Always subtract exactly 60 seconds when user was inactive (1 minute)
        // This is the core requirement: if user inactive for 1 minute, subtract that time
        let idleDuration = 60; // Always 60 seconds for 1 minute of inactivity

        console.log('🔍 DEBUG - pauseStartTimeRef:', pauseStartTimeRef.current, 'electronIdleTime:', electronIdleTime);
        console.log('🟢 FIXED IDLE DURATION: Always subtracting', idleDuration, 'seconds (1 minute of inactivity)');

        // Validate that we actually had an inactivity period (should have pauseStartTime or electronIdleTime)
        if (!pauseStartTimeRef.current && electronIdleTime === 0) {
            console.log('🔴 WARNING: No inactivity detected - this might be a manual resume');
            idleDuration = 0; // Don't subtract time if no inactivity was detected
        }
        console.log('🟢 Proceeding with resume - idleDuration:', idleDuration, 'seconds');

        isUpdatingStateRef.current = true;

        console.log('🟢 Resuming timer after activity');

        // Force clear any existing timer intervals before creating new ones
        if (timerIntervalRef.current) {
            console.log('🟢 Clearing existing timer interval during resume');
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        // idleDuration is now fixed to 60 seconds for inactivity periods
        console.log('🟢 FIXED: User was inactive - subtracting exactly', idleDuration, 'seconds from working time (1 minute of inactivity)');

        // Update refs immediately for consistency
        isTimerPausedRef.current = false;
        isPausedRef.current = false;

        // Use unstable_batchedUpdates to ensure all state changes happen together
        unstable_batchedUpdates(() => {
            // Get the actual working time when paused (includes idle time that needs to be subtracted)
            const pausedWorkingTime = actualElapsedRef.current;

            // CRITICAL: Subtract the idle time from the working time since user was inactive
            // Example: Timer shows 5:25 when paused, user was idle for 1 minute = actual work time is 4:25
            const actualWorkTime = Math.max(0, pausedWorkingTime - idleDuration);
            const newTotalWorkingTime = actualWorkTime;
            const newElapsed = actualWorkTime;

            console.log('🟢 Resume with idle time subtraction - pausedWorkingTime:', pausedWorkingTime, 'idleDuration:', idleDuration, 'actualWorkTime:', actualWorkTime, 'state totalWorkingTime:', totalWorkingTime);

            // Update both state and ref to keep them in sync with the corrected working time
            setTotalWorkingTime(newTotalWorkingTime);
            setElapsed(newElapsed);
            actualElapsedRef.current = newTotalWorkingTime; // Update ref to match corrected time

            setIsPaused(false);
            setIsTimerPaused(false);
            setTimerStatus('running'); // Reset timer status to running
            setShowIdleNotification(false);
            pauseStartTimeRef.current = null;
            setIdleStartTime(null); // Also clear idle start time

            // Show system notification for timer resume
            try {
                browserElectronService.showNotification(
                    'Timer Resumed',
                    `Your timer has been resumed at ${formatTime(actualWorkTime)}`
                ).catch(error => {
                    console.error('Failed to show resume notification:', error);
                });
            } catch (error) {
                console.error('Failed to show resume notification:', error);
            }

            // Force timer to restart with corrected base time (excluding idle time)
            // Add small delay to ensure state updates complete before timer restart
            setTimeout(() => {
                setTimerRestartKey((prev: number) => prev + 1);
            }, 10);

            console.log('🟢 BATCHED RESUME UPDATE COMPLETED - timer corrected to:', actualWorkTime, 'seconds (subtracted', idleDuration, 'idle seconds from', pausedWorkingTime, ')');
        });

        // Small delay to ensure all state updates are processed before timer restarts
        setTimeout(() => {
            isUpdatingStateRef.current = false;
        }, 50);
    };

    // Activity listener setup - moved here after handler functions are declared
    useEffect(() => {
        if (!activeEntry) return;
        if (!electronTrackingEnabled) return;

        console.log('🧠 Attaching Electron activity listener');

        let unsubscribe: (() => void) | null = null;

        // Try browser service first
        if (browserElectronService.isServiceAvailable) {
            console.log('🌐 Using browser Electron service for activity events');
            unsubscribe = browserElectronService.onActivityStatus((data: any) => {
                console.log('🧠 Browser Electron activity:', data);

                // Only process if timer is currently running
                if (!activeEntry || isTimerPausedRef.current === null) {
                    console.log('⏭️ Skipping activity event - no active timer');
                    return;
                }

                // Convert type to isIdle for consistency
                const isIdle = data.type === 'IDLE';

                // 🔴 PAUSE
                if (isIdle && !isTimerPausedRef.current) {
                    console.log('⛔ IDLE → pause timer');
                    handleTimerPause();
                    return;
                }

                // 🟢 RESUME
                if (!isIdle && isTimerPausedRef.current) {
                    console.log('▶️ ACTIVE → resume timer');
                    handleTimerResume(data.idleTime);
                    return;
                }
            });
        }
        // Fallback to native Electron IPC
        else if ((window as any).electron) {
            console.log('🖥️ Using native Electron IPC for activity events');
            unsubscribe = (window as any).electron.onActivityStatus((data: any) => {
                console.log('🧠 Native Electron activity:', data);

                // Only process if timer is currently running
                if (!activeEntry || isTimerPausedRef.current === null) {
                    console.log('⏭️ Skipping activity event - no active timer');
                    return;
                }

                // Convert type to isIdle for consistency
                const isIdle = data.type === 'IDLE';

                // 🔴 PAUSE
                if (isIdle && !isTimerPausedRef.current) {
                    console.log('⛔ IDLE → pause timer');
                    handleTimerPause();
                    return;
                }

                // 🟢 RESUME
                if (!isIdle && isTimerPausedRef.current) {
                    console.log('▶️ ACTIVE → resume timer');
                    handleTimerResume(data.idleTime);
                    return;
                }
            });
        } else {
            console.log('⚠️ No Electron service available for activity monitoring');
        }

        return () => {
            console.log('🧹 Removing Electron activity listener');
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [activeEntry?.id, electronTrackingEnabled, handleTimerPause, handleTimerResume]);

    const getProjectName = (projectId: string) => {
        const project = projects.find((p: any) => p.id === projectId);
        return project?.name || 'Unknown Project';
    };

    const getTaskName = (taskId: string) => taskMap.get(taskId) || 'Unknown Task';

    const handleWorkTypeChange = (workType: WorkType) => {
        console.log('Updating work type to:', workType);
        updateWorkType({
            variables: { workType: workType.toString() },
            onError: (error) => {
                console.error('GraphQL Error:', error);
                console.error('Error details:', error.graphQLErrors);
                console.error('Network error:', error.networkError);
            }
        });
    };

    const handleCheckIn = () => {
        checkIn();
    };




    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Time Tracker</h1>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Manage your time, track projects, and boost productivity
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => setShowWorkTypeSelector(true)}
                                className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                            >
                                {employeeWorkType === WorkType.REMOTE ? (
                                    <ComputerDesktopIcon className="h-5 w-5 mr-2" />
                                ) : (
                                    <HomeIcon className="h-5 w-5 mr-2" />
                                )}
                                {employeeWorkType === WorkType.REMOTE ? 'Remote' : 'Onsite'}
                            </button>
                            <button
                                onClick={() => setShowManualEntry(true)}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                <PlusIcon className="h-5 w-5 mr-2" />
                                Manual Entry
                            </button>
                            <button
                                onClick={() => setShowIdleSettings(true)}
                                className="inline-flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                            >
                                <FunnelIcon className="h-5 w-5 mr-2" />
                                Idle Settings
                            </button>
                            <button
                                onClick={() => {
                                    if (!screenshotConsent) {
                                        // Show consent dialog first
                                        const consent = confirm('This feature captures screenshots of your screen for activity monitoring. Do you consent to screen capture? You can disable this at any time.');
                                        if (consent) {
                                            setScreenshotConsent(true);
                                        }
                                    }
                                }}
                                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                            >
                                <CameraIcon className="h-5 w-5 mr-2" />
                                Screenshot Settings
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <nav className="flex space-x-8">
                        <button
                            onClick={() => setViewMode('dashboard')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${viewMode === 'dashboard'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center">
                                <ChartBarIcon className="h-5 w-5 mr-2" />
                                Dashboard
                            </div>
                        </button>
                        <button
                            onClick={() => setViewMode('timesheet')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${viewMode === 'timesheet'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center">
                                <DocumentTextIcon className="h-5 w-5 mr-2" />
                                Timesheet
                            </div>
                        </button>
                        <button
                            onClick={() => setViewMode('reports')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${viewMode === 'reports'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                        >
                            <div className="flex items-center">
                                <ArrowTrendingUpIcon className="h-5 w-5 mr-2" />
                                Reports
                            </div>
                        </button>
                    </nav>
                </div>
            </div>

            {/* Idle Settings Panel */}
            {showIdleSettings && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">
                                    Idle Detection Settings
                                </h3>
                                <div className="flex items-center space-x-2">
                                    <label htmlFor="idleThreshold" className="text-sm text-blue-700 dark:text-blue-300">
                                        Pause timer after:
                                    </label>
                                    <select
                                        id="idleThreshold"
                                        value={idleThreshold / 1000}
                                        onChange={(e) => setIdleThreshold(parseInt(e.target.value) * 1000)}
                                        className="block w-24 px-3 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    >
                                        <option value="30">30 sec</option>
                                        <option value="60">1 min</option>
                                        <option value="120">2 min</option>
                                        <option value="300">5 min</option>
                                        <option value="600">10 min</option>
                                    </select>
                                    <span className="text-sm text-blue-600 dark:text-blue-400">
                                        of inactivity
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowIdleSettings(false)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                            Timer will automatically pause when no user activity is detected for the specified duration and resume when activity resumes.
                        </p>
                    </div>
                </div>
            )}

            {/* Screenshot Settings Panel */}
            {screenshotConsent && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100">
                                    Screenshot Monitoring Settings
                                </h3>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="screenshotEnabled"
                                        checked={screenshotSettings.enabled}
                                        onChange={(e) => setScreenshotSettings((prev: typeof screenshotSettings) => ({ ...prev, enabled: e.target.checked }))}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                                    />
                                    <label htmlFor="screenshotEnabled" className="text-sm text-blue-700 dark:text-blue-300">
                                        Enable screenshot capture
                                    </label>
                                </div>
                                {screenshotSettings.enabled && (
                                    <div className="flex items-center space-x-2">
                                        <label htmlFor="screenshotInterval" className="text-sm text-blue-700 dark:text-blue-300">
                                            Capture every:
                                        </label>
                                        <select
                                            id="screenshotInterval"
                                            value={screenshotSettings.intervalMinutes}
                                            onChange={(e) => setScreenshotSettings((prev: typeof screenshotSettings) => ({ ...prev, intervalMinutes: parseInt(e.target.value) }))}
                                            className="block w-20 px-3 py-1 text-sm border border-blue-300 dark:border-blue-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                            <option value="1">1 min</option>
                                            <option value="5">5 min</option>
                                            <option value="10">10 min</option>
                                            <option value="15">15 min</option>
                                            <option value="30">30 min</option>
                                        </select>
                                        <span className="text-sm text-blue-600 dark:text-blue-400">
                                            (±{screenshotSettings.randomOffsetMinutes === 0.5 ? '30 sec' : screenshotSettings.randomOffsetMinutes + ' min'} random)
                                        </span>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setScreenshotConsent(false)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                            Screenshots are captured periodically for activity monitoring and stored securely.
                            You will be notified when screenshots are taken. This feature requires your explicit consent.
                        </p>
                        {lastScreenshotTime && (
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                                Last screenshot: {new Date(lastScreenshotTime).toLocaleString()}
                            </p>
                        )}
                        <button
                            onClick={() => {
                                console.log('🧪 Manual screenshot test triggered');
                                captureScreenForTracking();
                            }}
                            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors mt-2"
                        >
                            🧪 Test Screenshot
                        </button>
                    </div>
                </div>
            )}

            {/* Screenshot Gallery */}
            {screenshotConsent && screenshotSettings.enabled && screenshotHistory.length > 0 && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                            📸 Recent Screenshots ({screenshotHistory.length})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                            {screenshotHistory.map((screenshot, index) => (
                                <div key={screenshot.timestamp} className="relative group">
                                    <div className="aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                                        <img
                                            src={screenshot.data}
                                            alt={`Screenshot ${index + 1}`}
                                            className="w-full h-full object-cover"
                                            onClick={() => {
                                                // Create a modal or open in new tab
                                                const newWindow = window.open('', '_blank');
                                                if (newWindow) {
                                                    newWindow.document.write(`
                                                        <html>
                                                            <head>
                                                                <title>Screenshot ${index + 1}</title>
                                                                <style>
                                                                    body { margin: 0; padding: 20px; background: #1a1a1a; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                                                                    img { max-width: 100%; max-height: 100vh; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                                                                </style>
                                                            </head>
                                                            <body>
                                                                <img src="${screenshot.data}" alt="Screenshot ${index + 1}" />
                                                            </body>
                                                        </html>
                                                    `);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 rounded-b-lg">
                                        <p className="text-xs text-white truncate">
                                            {new Date(screenshot.timestamp).toLocaleTimeString()}
                                        </p>
                                        <p className="text-xs text-gray-300 truncate">
                                            {screenshot.filename.split('-').pop()?.replace('.png', '')}
                                        </p>
                                    </div>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                // Download screenshot
                                                const link = document.createElement('a');
                                                link.download = screenshot.filename;
                                                link.href = screenshot.data;
                                                link.click();
                                            }}
                                            className="bg-white/90 hover:bg-white text-gray-800 rounded-full p-1.5 shadow-lg"
                                            title="Download screenshot"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 text-center">
                            <button
                                onClick={() => {
                                    if (confirm('Clear all screenshot history? This cannot be undone.')) {
                                        setScreenshotHistory([]);
                                        // Clear from localStorage as well
                                        if (typeof window !== 'undefined') {
                                            localStorage.removeItem('screenshotHistory');
                                        }
                                        showNotification('Screenshot history cleared', 'success');
                                    }
                                }}
                                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            >
                                Clear History
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {viewMode === 'dashboard' && (
                    <div className="space-y-6">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <ClockIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Today</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{getTodayTotalTime()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <CalendarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">This Week</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{getWeekTotalTime()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <ArrowTrendingUpIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">This Month</p>
                                        <p className="text-2xl font-bold text-gray-900 dark:text-white">{getMonthTotalTime()}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0">
                                        <attendanceStatus.icon className={`h-8 w-8 text-${attendanceStatus.color}-600 dark:text-${attendanceStatus.color}-400`} />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{attendanceStatus.status}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Active Timer Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                                <div className="p-6">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                        Active Timer
                                    </h2>

                                    {activeEntry ? (
                                        <div className="text-center">
                                            {/* Timer status indicator with dynamic colors */}
                                            <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full mb-6 transition-all duration-300 ${timerStatus === 'running'
                                                ? 'bg-gradient-to-r from-green-400 to-green-600 animate-pulse'
                                                : timerStatus === 'idle'
                                                    ? 'bg-gradient-to-r from-orange-400 to-orange-600'
                                                    : 'bg-gradient-to-r from-gray-400 to-gray-600'
                                                }`}>
                                                {timerStatus === 'running' ? (
                                                    <ClockIcon className="h-16 w-16 text-white" />
                                                ) : timerStatus === 'idle' ? (
                                                    <PauseIcon className="h-16 w-16 text-white" />
                                                ) : (
                                                    <PauseIcon className="h-16 w-16 text-white" />
                                                )}
                                            </div>

                                            {/* Timer display with status-based styling */}
                                            <div className={`text-6xl font-bold mb-4 font-mono transition-colors duration-300 ${timerStatus === 'running'
                                                ? 'text-gray-900 dark:text-white'
                                                : timerStatus === 'idle'
                                                    ? 'text-orange-600 dark:text-orange-400'
                                                    : 'text-gray-500 dark:text-gray-400'
                                                }`}>
                                                {formatTime(displayTime)}
                                            </div>

                                            {/* Status indicator */}
                                            <div className={`mb-4 p-3 rounded-lg border transition-all duration-300 ${timerStatus === 'running'
                                                ? 'bg-green-100 dark:bg-green-900 border-green-300 dark:border-green-700'
                                                : timerStatus === 'idle'
                                                    ? 'bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700'
                                                    : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                                                }`}>
                                                <div className="flex items-center justify-center space-x-2">
                                                    {timerStatus === 'running' ? (
                                                        <>
                                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                            <span className="text-sm font-medium text-green-800 dark:text-green-200">
                                                                Timer Running
                                                            </span>
                                                        </>
                                                    ) : timerStatus === 'idle' ? (
                                                        <>
                                                            <PauseIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                                            <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                                                                Idle Time Detected (Frozen at: {formatTime(elapsed)})
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PauseIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                                Timer Paused
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                {timerStatus === 'idle' && (
                                                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1 text-center">
                                                        Move your mouse or press any key to resume tracking
                                                    </p>
                                                )}
                                                {timerStatus === 'paused' && (
                                                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 text-center">
                                                        Timer is manually paused
                                                    </p>
                                                )}

                                                {/* Electron Activity Tracking Status */}
                                                {isElectron && (
                                                    <div className={`mt-2 p-2 rounded text-xs flex items-center justify-center space-x-1 ${electronTrackingEnabled
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                                                        }`}>
                                                        {electronTrackingEnabled ? (
                                                            <>
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                                                <span>System Activity Tracking Active</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                                                <span>System Activity Tracking Inactive</span>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>


                                            <div className="mb-6">
                                                <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                                                    {activeEntry.description || 'Working...'}
                                                </p>
                                                {activeEntry.projectId && (
                                                    <p className="text-sm text-blue-600 dark:text-blue-400">
                                                        Project: {getProjectName(activeEntry.projectId)}
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={async () => {
                                                    if (!stopTimer) {
                                                        alert('Timer functionality is not available. Please check if the backend is running.');
                                                        return;
                                                    }

                                                    // Debug: Log current state
                                                    console.log('🛑 STOP BUTTON CLICKED - Current state:', {
                                                        activeEntry: !!activeEntry,
                                                        activeEntryId: activeEntry?.id,
                                                        cachedActiveEntry: !!cachedActiveEntry,
                                                        cachedEntryId: cachedActiveEntry?.id,
                                                        persistentCacheRef: !!persistentCacheRef.current,
                                                        persistentCacheId: persistentCacheRef.current?.id,
                                                        isTimerPaused,
                                                        timerStatus
                                                    });

                                                    // Check if there's actually an active timer before trying to stop it
                                                    const currentActiveEntry = activeEntry || persistentCacheRef.current || cachedActiveEntry;
                                                    if (!currentActiveEntry) {
                                                        console.log('🛑 STOP FAILED - No active entry found');
                                                        alert('No active timer found to stop.');
                                                        return;
                                                    }

                                                    console.log('🛑 PROCEEDING TO STOP TIMER - Entry ID:', currentActiveEntry.id);

                                                    // Set stopping flag to prevent duplicate calls
                                                    setIsStopping(true);

                                                    try {
                                                        // First, refresh the active entry to make sure we have the latest state
                                                        console.log('🔄 REFRESHING ACTIVE ENTRY BEFORE STOP');
                                                        const result = await refetchActiveEntry();
                                                        console.log('🔄 REFRESH RESULT:', result.data?.activeTimeEntry);

                                                        // Check if there's still an active timer after refresh
                                                        if (!result.data?.activeTimeEntry) {
                                                            console.log('🛑 NO ACTIVE TIMER ON BACKEND AFTER REFRESH');

                                                            // If we had an active timer in UI, try to stop anyway in case of race condition
                                                            if (currentActiveEntry) {
                                                                console.log('⚠️ RACE CONDITION DETECTED - UI had timer but backend shows none. Trying to stop anyway...');
                                                                try {
                                                                    await stopTimer({
                                                                        variables: {
                                                                            effectiveDurationSeconds: Math.max(
                                                                                0,
                                                                                Math.floor(actualElapsedRef.current)
                                                                            ),
                                                                        },
                                                                    });
                                                                    return;
                                                                } catch (stopError) {
                                                                    console.log('⚠️ Stop attempt failed, timer was already stopped');
                                                                    setIsStopping(false);
                                                                }
                                                                return;
                                                            }

                                                            // If we reach here, the timer was genuinely already stopped
                                                            console.log('✅ Timer was already stopped, just refreshing UI');
                                                            setCachedActiveEntry(null);
                                                            // Refresh all queries to ensure timesheet is updated
                                                            refetchActiveEntry();
                                                            refetchTimeEntries();
                                                            refetchTodaySessions();
                                                            setIsStopping(false);
                                                            return;
                                                        }

                                                        // If there's still an active timer, proceed with stop
                                                        console.log('🛑 STOPPING TIMER - BACKEND CONFIRMS ACTIVE TIMER');
                                                        await stopTimer({
                                                            variables: {
                                                                effectiveDurationSeconds: Math.max(
                                                                    0,
                                                                    Math.floor(actualElapsedRef.current)
                                                                ),
                                                            },
                                                        });
                                                    } catch (error: any) {
                                                        console.error('❌ ERROR DURING STOP:', error);
                                                        setIsStopping(false);
                                                        // onError already alerts for Network error; avoid duplicate
                                                        if (!error?.networkError && !error?.message?.includes?.('Network error')) {
                                                            alert('Failed to stop timer. Please try again.');
                                                        }
                                                    }
                                                }}
                                                disabled={isStopping}
                                                className="w-full inline-flex items-center justify-center px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                                            >
                                                <StopIcon className="h-5 w-5 mr-2" />
                                                {isStopping ? 'Stopping...' : 'Stop Timer'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 mb-6">
                                                <ClockIcon className="h-16 w-16 text-gray-400" />
                                            </div>
                                            <div className="text-6xl font-bold text-gray-900 dark:text-white mb-4 font-mono">
                                                00:00:00
                                            </div>
                                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                                No active timer
                                            </p>

                                            {/* Project and Task Selection */}
                                            <div className="space-y-4 mb-6">
                                                {!hasAssignedTasks ? (
                                                    <>
                                                        <div className="text-center py-8 px-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                                            <InformationCircleIcon className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                                                            <p className="text-blue-800 dark:text-blue-200 font-medium">
                                                                No tasks assigned to you
                                                            </p>
                                                            <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                                                                Describe what you're working on below
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                                What are you working on?
                                                            </label>
                                                            <textarea
                                                                value={taskDescription}
                                                                onChange={(e) => setTaskDescription(e.target.value)}
                                                                placeholder="Describe your work..."
                                                                rows={3}
                                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                            />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                                Select Project
                                                            </label>
                                                            <select
                                                                value={selectedProject}
                                                                onChange={(e) => {
                                                                    setSelectedProject(e.target.value);
                                                                    setSelectedTask('');
                                                                }}
                                                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                            >
                                                                <option value="">Choose a project...</option>
                                                                {projects.map((project: any) => (
                                                                    <option key={project.id} value={project.id}>
                                                                        {project.name}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        {selectedProject && (
                                                            <div>
                                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                                    Select Task (Optional)
                                                                </label>
                                                                <select
                                                                    value={selectedTask}
                                                                    onChange={(e) => setSelectedTask(e.target.value)}
                                                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                                                >
                                                                    <option value="">Choose a task...</option>
                                                                    {tasks.map((task: any) => (
                                                                        <option key={task.id} value={task.id}>
                                                                            {task.parentTask ? `${task.parentTask.title} › ${task.title}` : task.title}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            <button
                                                onClick={handleStartTimer}
                                                disabled={!hasAssignedTasks && !taskDescription.trim()}
                                                className={`w-full inline-flex items-center justify-center px-6 py-3 rounded-lg transition-colors ${(!hasAssignedTasks && !taskDescription.trim())
                                                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                    : 'bg-green-600 hover:bg-green-700 text-white'
                                                    }`}
                                            >
                                                <PlayIcon className="h-5 w-5 mr-2" />
                                                Start Timer
                                            </button>
                                        </div>
                                    )}

                                </div>
                            </div>

                            {/* Attendance Card */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                                <div className="p-6">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                        Daily Attendance
                                    </h2>

                                    <div className="space-y-6">
                                        <div className={`p-4 rounded-lg ${attendanceStatus.color === 'green'
                                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                            : attendanceStatus.color === 'blue'
                                                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                                : 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                                            }`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center">
                                                    <attendanceStatus.icon className={`h-6 w-6 text-${attendanceStatus.color}-600 dark:text-${attendanceStatus.color}-400 mr-3`} />
                                                    <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                                        {attendanceStatus.status}
                                                    </span>
                                                </div>
                                                <span className={`px-3 py-1 text-sm rounded-full bg-${attendanceStatus.color}-100 text-${attendanceStatus.color}-800 dark:bg-${attendanceStatus.color}-900/20 dark:text-${attendanceStatus.color}-400`}>
                                                    {attendanceStatus.text}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                onClick={handleCheckIn}
                                                disabled={
                                                    (employeeWorkType === WorkType.ONSITE && todaySessions.some((s: any) => s.checkIn && !s.checkOut)) ||
                                                    (employeeWorkType === WorkType.REMOTE && todaySessions.some((s: any) => s.checkIn && !s.checkOut))
                                                }
                                                className={`inline-flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-colors ${(employeeWorkType === WorkType.ONSITE && todaySessions.some((s: any) => s.checkIn && !s.checkOut)) ||
                                                    (employeeWorkType === WorkType.REMOTE && todaySessions.some((s: any) => s.checkIn && !s.checkOut))
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    }`}
                                            >
                                                <PlayIcon className="h-5 w-5 mr-2" />
                                                {employeeWorkType === WorkType.ONSITE && todaySessions.some((s: any) => s.checkIn)
                                                    ? 'Already Checked In'
                                                    : 'Check In'
                                                }
                                            </button>
                                            <button
                                                onClick={() => checkOut()}
                                                disabled={!todaySessions.some((s: any) => s.checkIn && !s.checkOut)}
                                                className={`inline-flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-colors ${!todaySessions.some((s: any) => s.checkIn && !s.checkOut)
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-gray-600 hover:bg-gray-700 text-white'
                                                    }`}
                                            >
                                                <StopIcon className="h-5 w-5 mr-2" />
                                                Check Out
                                            </button>
                                        </div>

                                        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                                            {employeeWorkType === WorkType.REMOTE && todaySessions.length > 0 ? (
                                                <div>
                                                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Today's Sessions</h4>
                                                    <div className="space-y-2">
                                                        {todaySessions.map((session: any, index: number) => (
                                                            <div key={session.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                                                <div className="flex items-center space-x-3">
                                                                    <div className="flex-shrink-0">
                                                                        <div className={`w-2 h-2 rounded-full ${session.checkIn && !session.checkOut
                                                                            ? 'bg-green-500'
                                                                            : 'bg-gray-400'
                                                                            }`} />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                                            Session {session.sessionNumber}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                                            {formatTimeFromDate(session.checkIn)} - {formatTimeFromDate(session.checkOut) || 'Active'}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                                        {session.totalHours ? `${session.totalHours}h` : 'In progress'}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {todaySessions.some((s: any) => s.totalHours) && (
                                                        <div className="mt-4 text-center">
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Hours Today</p>
                                                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                                {todaySessions.reduce((sum: number, s: any) => sum + (s.totalHours || 0), 0).toFixed(2)}h
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div>
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="text-center">
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Check In</p>
                                                            <p className="text-xl font-semibold text-gray-900 dark:text-white">
                                                                {formatTimeFromDate(todaySessions[0]?.checkIn)}
                                                            </p>
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Check Out</p>
                                                            <p className="text-xl font-semibold text-gray-900 dark:text-white">
                                                                {formatTimeFromDate(todaySessions[0]?.checkOut)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {todaySessions[0]?.totalHours && (
                                                        <div className="mt-6 text-center">
                                                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Hours</p>
                                                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                                {todaySessions[0].totalHours.toFixed(2)}h
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'timesheet' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
                            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Time Entries
                                    </h2>
                                    <div className="flex items-center flex-wrap gap-2">
                                        <select
                                            value={timesheetFilter === 'custom' ? 'custom' : timesheetFilter}
                                            onChange={(e) => {
                                                const v = e.target.value as TimesheetFilterValue;
                                                if (v === 'custom') {
                                                    setTimesheetFilter('custom');
                                                } else {
                                                    setTimesheetFilter(v);
                                                }
                                            }}
                                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                        >
                                            <option value="today">Today</option>
                                            <option value="week">This Week</option>
                                            <option value="month">This Month</option>
                                            <option value="lastMonth">Last Month</option>
                                            <option value="custom">Pick a month…</option>
                                        </select>
                                        {timesheetFilter === 'custom' && (
                                            <select
                                                value={customMonth}
                                                onChange={(e) => setCustomMonth(e.target.value)}
                                                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                            >
                                                {getPreviousMonthsOptions().map(({ value, label }) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        )}
                                        <button className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors ml-auto sm:ml-0">
                                            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
                                            Export
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Project
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Task / Description
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Start Time
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                End Time
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Duration
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {getFilteredTimeEntries().map((entry: any) => (
                                            <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {formatDate(entry.startTime)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {entry.taskId ? (
                                                        (() => {
                                                            const task = myTasks.find((t: any) => t.id === entry.taskId) ?? tasks.find((t: any) => t.id === entry.taskId);
                                                            const projectName = task ? (task.project?.name ?? projectMap.get(task.projectId)) : null;
                                                            return (
                                                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                                    {projectName || 'Unknown Project'}
                                                                </p>
                                                            );
                                                        })()
                                                    ) : (
                                                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            No Project
                                                        </p>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    {entry.taskId ? (
                                                        <div>
                                                            <p className="font-medium text-gray-900 dark:text-white">
                                                                {(taskMap.get(entry.taskId) as string) || 'Unknown Task'}
                                                            </p>
                                                            {entry.description && (
                                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                    {entry.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <p className="text-gray-900 dark:text-white">
                                                                {entry.description || 'No description'}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                                No task assigned
                                                            </p>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {formatTimeFromDate(entry.startTime)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {entry.endTime ? formatTimeFromDate(entry.endTime) : '-'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <ClockIcon className="h-4 w-4 text-gray-400 mr-1" />
                                                        <span className="text-sm text-gray-900 dark:text-white">
                                                            {calculateEntryDuration(entry)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${entry.endTime
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                                        }`}>
                                                        {entry.endTime ? 'Completed' : 'Active'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {getFilteredTimeEntries().length === 0 && (
                                    <div className="text-center py-12">
                                        <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                            No time entries found for the selected period
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {viewMode === 'reports' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Weekly Overview
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Total Hours</span>
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">{getWeekTotalTime()}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Daily Average</span>
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">6h 24m</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 dark:text-gray-400">Most Productive Day</span>
                                        <span className="text-xl font-bold text-green-600 dark:text-green-400">Wednesday</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Project Distribution
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Website Redesign</span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">45%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-blue-600 h-2 rounded-full" style={{ width: '45%' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">Mobile App</span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">30%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-green-600 h-2 rounded-full" style={{ width: '30%' }}></div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-sm text-gray-600 dark:text-gray-400">API Development</span>
                                            <span className="text-sm font-medium text-gray-900 dark:text-white">25%</span>
                                        </div>
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                            <div className="bg-purple-600 h-2 rounded-full" style={{ width: '25%' }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                Productivity Trends
                            </h3>
                            <div className="grid grid-cols-7 gap-2">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                                    <div key={day} className="text-center">
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{day}</p>
                                        <div className="h-24 bg-gray-100 dark:bg-gray-700 rounded relative">
                                            <div
                                                className="absolute bottom-0 w-full bg-blue-500 rounded"
                                                style={{ height: `${Math.random() * 80 + 20}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Manual Entry Modal */}
            {showManualEntry && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Manual Time Entry
                            </h3>
                            <button
                                onClick={() => setShowManualEntry(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={manualEntry.date}
                                    onChange={(e) => setManualEntry((prev: typeof manualEntry) => ({ ...prev, date: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Start Time
                                    </label>
                                    <input
                                        type="time"
                                        value={manualEntry.startTime}
                                        onChange={(e) => setManualEntry((prev: typeof manualEntry) => ({ ...prev, startTime: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={manualEntry.endTime}
                                        onChange={(e) => setManualEntry((prev: typeof manualEntry) => ({ ...prev, endTime: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Project
                                </label>
                                <select
                                    value={manualEntry.projectId}
                                    onChange={(e) => setManualEntry((prev: typeof manualEntry) => ({ ...prev, projectId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                >
                                    <option value="">Select a project...</option>
                                    {projects.map((project: any) => (
                                        <option key={project.id} value={project.id}>
                                            {project.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Description
                                </label>
                                <textarea
                                    value={manualEntry.description}
                                    onChange={(e) => setManualEntry((prev: typeof manualEntry) => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    placeholder="Describe your work..."
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                />
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button
                                    onClick={() => setShowManualEntry(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        // Handle manual entry submission
                                        setShowManualEntry(false);
                                    }}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                >
                                    Add Entry
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Work Type Selector Modal */}
            {showWorkTypeSelector && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Select Work Type
                            </h3>
                            <button
                                onClick={() => setShowWorkTypeSelector(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <XMarkIcon className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Choose your work type to determine check-in/check-out behavior:
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleWorkTypeChange(WorkType.REMOTE)}
                                    className={`w-full p-4 rounded-lg border-2 transition-all ${employeeWorkType === WorkType.REMOTE
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                                        }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <ComputerDesktopIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                        <div className="text-left">
                                            <h4 className="font-semibold text-gray-900 dark:text-white">Remote Work</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Multiple check-ins allowed, flexible hours
                                            </p>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleWorkTypeChange(WorkType.ONSITE)}
                                    className={`w-full p-4 rounded-lg border-2 transition-all ${employeeWorkType === WorkType.ONSITE
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                                        : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                                        }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <HomeIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                                        <div className="text-left">
                                            <h4 className="font-semibold text-gray-900 dark:text-white">Onsite Work</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                Single check-in per day, fixed hours
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={() => setShowWorkTypeSelector(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Check-in Success Toast Notification */}
            {showCheckInSuccessToast && (
                <div className="fixed bottom-4 right-4 z-50 animate-pulse">
                    <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg shadow-lg max-w-sm">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium text-green-800">
                                    Successfully Checked In
                                </p>
                                <p className="text-sm text-green-700 mt-1">
                                    Your work session has started. Have a productive day!
                                </p>
                            </div>
                            <div className="ml-auto pl-3">
                                <button
                                    onClick={() => setShowCheckInSuccessToast(false)}
                                    className="inline-flex text-green-400 hover:text-green-600 focus:outline-none"
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Onsite Check-in Toast Notification */}
            {showOnsiteCheckInToast && (
                <div className="fixed bottom-4 right-4 z-50 animate-pulse">
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg max-w-sm">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium text-yellow-800">
                                    Already Checked In
                                </p>
                                <p className="text-sm text-yellow-700 mt-1">
                                    Onsite employees can only check in once per day. Please check out first.
                                </p>
                            </div>
                            <div className="ml-auto pl-3">
                                <button
                                    onClick={() => setShowOnsiteCheckInToast(false)}
                                    className="inline-flex text-yellow-400 hover:text-yellow-600 focus:outline-none"
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Idle Time Detection Toast Notification */}
            {showIdleNotification && (
                <div className="fixed bottom-4 right-4 z-50 animate-pulse">
                    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg shadow-lg max-w-sm">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <PauseIcon className="h-5 w-5 text-orange-400" />
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium text-orange-800">
                                    Timer Paused - Idle Time Detected
                                </p>
                                <p className="text-sm text-orange-700 mt-1">
                                    No activity detected for 1 minute. Timer will resume when you return.
                                </p>
                            </div>
                            <div className="ml-auto pl-3">
                                <button
                                    onClick={() => setShowIdleNotification(false)}
                                    className="inline-flex text-orange-400 hover:text-orange-600 focus:outline-none"
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* General Notification Toast */}
            {notification && (
                <div className="fixed bottom-4 right-4 z-50 animate-pulse">
                    <div className={`
                        border-l-4 p-4 rounded-lg shadow-lg max-w-sm
                        ${notification.type === 'success' ? 'bg-green-50 border-green-400' :
                            notification.type === 'error' ? 'bg-red-50 border-red-400' :
                                'bg-yellow-50 border-yellow-400'}
                    `}>
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                {notification.type === 'success' && (
                                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                )}
                                {notification.type === 'error' && (
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                )}
                                {notification.type === 'warning' && (
                                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3">
                                <p className={`
                                    text-sm font-medium
                                    ${notification.type === 'success' ? 'text-green-800' :
                                        notification.type === 'error' ? 'text-red-800' :
                                            'text-yellow-800'}
                                `}>
                                    {notification.message}
                                </p>
                            </div>
                            <div className="ml-auto pl-3">
                                <button
                                    onClick={() => setNotification(null)}
                                    className={`
                                        inline-flex focus:outline-none
                                        ${notification.type === 'success' ? 'text-green-400 hover:text-green-600' :
                                            notification.type === 'error' ? 'text-red-400 hover:text-red-600' :
                                                'text-yellow-400 hover:text-yellow-600'}
                                    `}
                                >
                                    <span className="sr-only">Dismiss</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
