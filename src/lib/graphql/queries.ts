import { gql } from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(input: { email: $email, password: $password }) {
      accessToken
      refreshToken
      user {
        id
        name
        email
        role
        department
      }
    }
  }
`;

export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accessToken
      refreshToken
      user {
        id
        name
        email
        role
        department
        phone
        skills
        salaryType
        salaryAmount
        status
      }
    }
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      name
      email
      role
      phone
      department
      skills
      salaryType
      salaryAmount
      status
      lastActive
    }
  }
`;

export const GET_USERS = gql`
  query GetUsers($filters: UserFiltersInput) {
    users(filters: $filters) {
      id
      name
      email
      role
      department
      status
      lastActive
    }
  }
`;

export const GET_PROJECTS = gql`
  query GetProjects($filters: ProjectFiltersInput) {
    projects(filters: $filters) {
      id
      name
      description
      note
      attachments {
        id
        originalName
        mimeType
        size
        createdAt
      }
      budget
      hourlyRate
      status
      startDate
      endDate
      clientName
      createdBy {
        id
        name
      }
      createdAt
    }
  }
`;

export const GET_PROJECT = gql`
  query GetProject($id: String!) {
    project(id: $id) {
      id
      name
      description
      note
      attachments {
        id
        originalName
        mimeType
        size
        createdAt
      }
      budget
      hourlyRate
      status
      startDate
      endDate
      clientName
      createdBy {
        id
        name
        email
      }
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_PROJECT = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
      budget
      hourlyRate
      status
    }
  }
`;

export const GET_TASKS = gql`
  query GetTasks($filters: TaskFiltersInput) {
    tasks(filters: $filters) {
      id
      title
      description
      note
      attachments {
        id
        originalName
        mimeType
        size
        createdAt
      }
      status
      priority
      projectId
      listId
      assignedToId
      startDate
      dueDate
      timeSpent
      estimatedTime
      parentTaskId
      createdAt
      updatedAt
      project {
        id
        name
      }
      assignees {
        id
        name
        email
      }
      subTasks {
        id
        title
        description
        note
        status
        priority
        projectId
        listId
        assignedToId
        dueDate
        estimatedTime
        timeSpent
        parentTaskId
        createdAt
        updatedAt
        attachments {
          id
          originalName
          mimeType
          size
          createdAt
        }
        project {
          id
          name
        }
        subTasks {
          id
          title
          status
          priority
          projectId
          listId
          assignedToId
          parentTaskId
        }
        assignees {
          id
          name
          email
        }
      }
    }
  }
`;

export const GET_TASKS_FOR_SELECTION = gql`
  query GetTasksForSelection($filters: TaskFiltersInput) {
    tasksForSelection(filters: $filters) {
      id
      title
      projectId
      listId
      parentTaskId
      parentTask {
        id
        title
      }
      project {
        id
        name
      }
    }
  }
`;

export const GET_TASK_LISTS = gql`
  query GetTaskLists($projectId: String!) {
    taskLists(projectId: $projectId) {
      id
      projectId
      name
      description
      order
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_TASK_LIST = gql`
  mutation CreateTaskList($input: CreateTaskListInput!) {
    createTaskList(input: $input) {
      id
      projectId
      name
      description
      order
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_TASK_LIST = gql`
  mutation UpdateTaskList($id: String!, $input: UpdateTaskListInput!) {
    updateTaskList(id: $id, input: $input) {
      id
      projectId
      name
      description
      order
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_TASK_LIST = gql`
  mutation DeleteTaskList($id: String!) {
    deleteTaskList(id: $id)
  }
`;

export const GET_TASK = gql`
  query GetTask($id: String!) {
    task(id: $id) {
      id
      title
      description
      note
      status
      priority
      projectId
      assignedToId
      startDate
      dueDate
      timeSpent
      estimatedTime
      createdAt
      updatedAt
    }
  }
`;

export const GET_TASK_DETAILS = gql`
  query GetTaskDetails($id: String!) {
    task(id: $id) {
      id
      title
      description
      note
      attachments {
        id
        originalName
        mimeType
        size
        createdAt
      }
      status
      priority
      projectId
      listId
      assignedToId
      startDate
      dueDate
      timeSpent
      estimatedTime
      parentTaskId
      createdAt
      updatedAt
      project {
        id
        name
      }
      parentTask {
        id
        title
      }
      assignedTo {
        id
        name
        email
      }
      createdBy {
        id
        name
        email
      }
      assignees {
        id
        name
        email
      }
      subTasks {
        id
        title
        description
        note
        status
        priority
        dueDate
        timeSpent
        estimatedTime
        attachments {
          id
          originalName
          mimeType
          size
          createdAt
        }
        assignedTo {
          id
          name
          email
        }
      }
      comments {
        id
        content
        createdAt
        user {
          id
          name
          email
        }
      }
    }
  }
`;

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      title
      description
      note
      status
      priority
      projectId
      listId
      assignedToId
      startDate
      dueDate
      timeSpent
      estimatedTime
      parentTaskId
      createdAt
      updatedAt
      project {
        id
        name
      }
      subTasks {
        id
        title
        status
        priority
        projectId
        listId
        parentTaskId
      }
      assignees {
        id
        name
        email
      }
    }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask($id: String!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      description
      note
      status
      priority
      projectId
      assignedToId
      startDate
      dueDate
      timeSpent
      estimatedTime
      createdAt
      updatedAt
      assignees {
        id
        name
        email
      }
    }
  }
`;

export const DELETE_TASK = gql`
  mutation DeleteTask($id: String!) {
    deleteTask(id: $id)
  }
`;

export const ADD_COMMENT = gql`
  mutation AddComment($taskId: String!, $content: String!) {
    addComment(taskId: $taskId, content: $content) {
      id
      content
      createdAt
      user {
        id
        name
        email
      }
    }
  }
`;

export const CHECK_IN = gql`
  mutation CheckIn {
    checkIn {
      id
      checkIn
      date
    }
  }
`;

export const CHECK_OUT = gql`
  mutation CheckOut {
    checkOut {
      id
      checkOut
      totalHours
    }
  }
`;

export const START_TIME_ENTRY = gql`
  mutation StartTimeEntry($input: StartTimeEntryInput!) {
    startTimeEntry(input: $input) {
      id
      startTime
      endTime
      duration
      description
      taskId
      employeeId
      isManual
      createdAt
    }
  }
`;

export const STOP_TIME_ENTRY = gql`
  mutation StopTimeEntry($effectiveDurationSeconds: Int) {
    stopTimeEntry(effectiveDurationSeconds: $effectiveDurationSeconds) {
      id
      startTime
      endTime
      duration
      description
      taskId
      employeeId
      isManual
      createdAt
    }
  }
`;

export const GET_ACTIVE_TIME_ENTRY = gql`
  query GetActiveTimeEntry {
    activeTimeEntry {
      id
      startTime
      endTime
      duration
      description
      taskId
      employeeId
      isManual
      createdAt
    }
  }
`;

export const GET_ACTIVE_TEAM_TIMERS = gql`
  query GetActiveTeamTimers {
    activeTeamTimers {
      entryId
      employeeId
      employeeName
      taskId
      startTime
    }
  }
`;

export const GET_TODAY_TIMESHEET = gql`
  query GetTodayTimesheet {
    todayTimesheet {
      id
      date
      checkIn
      checkOut
      totalHours
      status
      notes
      sessionNumber
      employeeId
      createdAt
      updatedAt
      employee {
        id
        name
        email
        workType
      }
    }
  }
`;

export const GET_TODAY_SESSIONS = gql`
  query GetTodaySessions {
    todaySessions {
      id
      date
      checkIn
      checkOut
      totalHours
      status
      notes
      sessionNumber
      employeeId
      createdAt
      updatedAt
      employee {
        id
        name
        email
        workType
      }
    }
  }
`;

export const UPDATE_EMPLOYEE_WORK_TYPE = gql`
  mutation UpdateEmployeeWorkType($workType: String!) {
    updateEmployeeWorkType(workType: $workType) {
      id
      name
      email
      workType
    }
  }
`;

export const GET_EMPLOYEE_WORK_TYPE = gql`
  query GetEmployeeWorkType {
    employeeWorkType
  }
`;

export const GET_TIME_ENTRIES = gql`
  query GetTimeEntries($employeeId: String, $taskId: String, $taskIds: [String!]) {
    timeEntries(employeeId: $employeeId, taskId: $taskId, taskIds: $taskIds) {
      id
      startTime
      endTime
      duration
      description
      taskId
      employeeId
      isManual
      createdAt
      employee {
        id
        name
        email
      }
    }
  }
`;

export const ADMIN_CREATE_MANUAL_TIME_ENTRY = gql`
  mutation AdminCreateManualTimeEntry($input: AdminCreateManualTimeEntryInput!) {
    adminCreateManualTimeEntry(input: $input) {
      id
      startTime
      endTime
      duration
      description
      taskId
      employeeId
      isManual
      createdAt
      employee {
        id
        name
        email
      }
    }
  }
`;

export const ADMIN_UPDATE_TIME_ENTRY = gql`
  mutation AdminUpdateTimeEntry($id: String!, $input: AdminUpdateTimeEntryInput!) {
    adminUpdateTimeEntry(id: $id, input: $input) {
      id
      startTime
      endTime
      duration
      description
      taskId
      employeeId
      isManual
      createdAt
      employee {
        id
        name
        email
      }
    }
  }
`;

export const ADMIN_DELETE_TIME_ENTRY = gql`
  mutation AdminDeleteTimeEntry($id: String!) {
    adminDeleteTimeEntry(id: $id)
  }
`;

/** Report: total time per employee per day, with projects. For admin view and export. Uses existing TimeEntry data. */
export const GET_EMPLOYEE_DAILY_ACTIVITY = gql`
  query GetEmployeeDailyActivity($startDate: DateTime!, $endDate: DateTime!, $employeeId: String) {
    employeeDailyActivity(startDate: $startDate, endDate: $endDate, employeeId: $employeeId) {
      employeeId
      employeeName
      email
      date
      totalSeconds
      projects {
        projectId
        projectName
        seconds
      }
    }
  }
`;

export const GET_TIMESHEETS = gql`
  query GetTimesheets($employeeId: String, $startDate: Date, $endDate: Date) {
    timesheets(employeeId: $employeeId, startDate: $startDate, endDate: $endDate) {
      id
      date
      checkIn
      checkOut
      totalHours
      status
      notes
      employeeId
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_USER = gql`
  mutation UpdateUser($id: String!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      name
      email
      role
      phone
      department
      skills
      salaryType
      salaryAmount
      status
    }
  }
`;

export const CHANGE_USER_PASSWORD = gql`
  mutation ChangeUserPassword($id: String!, $newPassword: String!) {
    changeUserPassword(id: $id, newPassword: $newPassword)
  }
`;

export const DELETE_USER = gql`
  mutation DeleteUser($id: String!) {
    deleteUser(id: $id)
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken($refreshToken: String!) {
    refreshToken(refreshToken: $refreshToken) {
      accessToken
      refreshToken
    }
  }
`;

export const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

export const UPDATE_PROJECT = gql`
  mutation UpdateProject($id: String!, $input: UpdateProjectInput!) {
    updateProject(id: $id, input: $input) {
      id
      name
      description
      budget
      hourlyRate
      status
      startDate
      endDate
      clientName
      updatedAt
    }
  }
`;

export const DELETE_PROJECT = gql`
  mutation DeleteProject($id: String!) {
    deleteProject(id: $id)
  }
`;

export const REPORT_ACTIVITY = gql`
  mutation ReportActivity($type: String!, $metadata: JSON) {
    reportActivity(type: $type, metadata: $metadata)
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    notifications {
      id
      userId
      title
      message
      type
      isRead
      link
      createdAt
    }
  }
`;

export const GET_NOTIFICATION_UNREAD_COUNT = gql`
  query GetNotificationUnreadCount {
    notificationUnreadCount
  }
`;

export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($id: String!) {
    markNotificationAsRead(id: $id) {
      id
      isRead
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;

export const GET_WORK_SCHEDULE = gql`
  query GetWorkSchedule($userId: String) {
    workSchedule(userId: $userId) {
      userId
      weekendDays
      updatedAt
      intervals {
        id
        startMinutes
        endMinutes
      }
    }
  }
`;

export const GET_TEAM_WORK_SCHEDULES = gql`
  query GetTeamWorkSchedules {
    teamWorkSchedules {
      user {
        id
        name
        email
      }
      schedule {
        userId
        weekendDays
        updatedAt
        intervals {
          id
          startMinutes
          endMinutes
        }
      }
    }
  }
`;

export const SET_MY_WORK_SCHEDULE = gql`
  mutation SetMyWorkSchedule($input: SetWorkScheduleInput!) {
    setMyWorkSchedule(input: $input) {
      userId
      weekendDays
      updatedAt
      intervals {
        id
        startMinutes
        endMinutes
      }
    }
  }
`;

export const SET_USER_WORK_SCHEDULE = gql`
  mutation SetUserWorkSchedule($userId: String!, $input: SetWorkScheduleInput!) {
    setUserWorkSchedule(userId: $userId, input: $input) {
      userId
      weekendDays
      updatedAt
      intervals {
        id
        startMinutes
        endMinutes
      }
    }
  }
`;

/** Admins configured to receive “task ready for review” alerts. Empty = all active admins. */
export const GET_TASK_REVIEW_ADMINS = gql`
  query GetTaskReviewAdmins {
    taskReviewAdmins {
      id
      name
      email
    }
  }
`;

export const SET_TASK_REVIEW_ADMINS = gql`
  mutation SetTaskReviewAdmins($userIds: [String!]!) {
    setTaskReviewAdmins(userIds: $userIds) {
      id
      name
      email
    }
  }
`;
