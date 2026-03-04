export enum WorkType {
  REMOTE = 'REMOTE',
  ONSITE = 'ONSITE'
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  workType?: WorkType;
}

export interface Timesheet {
  id: string;
  employeeId: string;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  totalHours?: number;
  sessionNumber: number;
  status: string;
  employee?: Employee;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  taskId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  description?: string;
}