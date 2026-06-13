export type Division = "PNC" | "GWMA" | "GWMSI" | "IB";
export type RoleType = "CASE_OWNER" | "APPROVER" | "ADMIN";
export type CaseStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "ACTIVE"
  | "RETURNED"
  | "REMOVAL_PENDING"
  | "CLOSED";

export interface Persona {
  id: number;
  name: string;
  initials: string;
  role: RoleType;
  division?: Division;
  email?: string;
  isActive?: boolean;
}

export interface WatchCase {
  id: number;
  reference: string;
  borrower: string;
  division: Division;
  sector: string;
  exposure: number;
  riskRating: string;
  previousRating: string;
  status: CaseStatus;
  owner: string;
  approver: string;
  nextReview: string;
  daysOnWatchlist: number;
  triggers: string[];
  summary: string;
  actionProgress: number;
  openActions: number;
  overdueActions: number;
  lastActivity: string;
}

export interface Review {
  id: number;
  caseId: number;
  borrower: string;
  period: string;
  dueDate: string;
  dueDateValue: string;
  status: "DUE" | "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "RETURNED";
  owner: string;
  recommendation: string;
  division: Division;
  commentary: string;
}

export interface CaseCreateInput {
  borrower: string;
  division: Division;
  sector: string;
  exposure: number;
  risk_rating: string;
  previous_rating: string;
  summary: string;
  triggers: string[];
  next_review_date: string;
}
