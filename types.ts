export enum ApplicationStatus {
  Pending = "待定",
  Passed = "通过",
  Rejected = "未通过",
}

export enum FinalResult {
  Hired = "录用",
  ToBeDiscussed = "有待商榷",
  NotHired = "不录用",
}

export interface InterviewSlot {
  id: string;
  start: string; // ISO String for date
  end: string;   // ISO String for date
}

export interface Interviewer {
  id:string;
  name: string;
  department: string;
}

export type DepartmentAvailability = Record<string, Record<string, number>>; // { [departmentName]: { [slotId]: capacity } }

export interface RecruitmentSettings {
  participatingDepartments: string[];
  interviewSlots: InterviewSlot[];
  invitationCode: string;
  adminPassword?: string;
}

export interface Applicant {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  major: string;
  contact: string;
  email: string;
  firstChoice: string;
  secondChoice: string;
  resumeFile: File | null;
  availableTimes1: string[]; // IDs of InterviewSlots for first choice
  availableTimes2: string[]; // IDs of InterviewSlots for second choice
  customTime: string;
  submissionDate: string;
  status: {
    resume: ApplicationStatus;
    firstInterview: ApplicationStatus;
    secondInterview: ApplicationStatus;
    finalResult: FinalResult;
  };
  scheduledInterview1?: {
    interviewerId: string;
    slotId: string;
    time: string; // ISO String
  };
  scheduledInterview2?: {
    interviewerId: string;
    slotId: string;
    time: string; // ISO String
  };
}

export interface InterviewFeedback {
  id: string;
  feedbackText: string;
  submissionDate: string;
}