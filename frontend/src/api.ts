import type {
  CaseCreateInput,
  Division,
  Persona,
  Review,
  RoleType,
  WatchCase,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8001/api";

interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: RoleType;
  division: Division | null;
  is_active: boolean;
}

interface ApiCase {
  id: number;
  reference: string;
  borrower: string;
  division: Division;
  sector: string;
  exposure: string;
  risk_rating: string;
  previous_rating: string;
  status: WatchCase["status"];
  summary: string;
  triggers: string[];
  owner: ApiUser;
  approver: ApiUser;
  next_review_date: string;
  created_at: string;
  updated_at: string;
}

interface ApiReview {
  id: number;
  case_id: number;
  borrower: string;
  owner: string;
  division: Division;
  period: string;
  due_date: string;
  status: Review["status"];
  recommendation: string;
  commentary: string;
}

async function request<T>(
  path: string,
  userId?: number,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "x-user-id": String(userId) } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const displayDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );

const mapUser = (user: ApiUser): Persona => ({
  id: user.id,
  name: user.name,
  initials: initials(user.name),
  role: user.role,
  division: user.division ?? undefined,
  email: user.email,
  isActive: user.is_active,
});

const mapCase = (item: ApiCase): WatchCase => {
  const createdAt = new Date(item.created_at);
  const daysOnWatchlist = Math.max(
    0,
    Math.floor((Date.now() - createdAt.getTime()) / 86_400_000),
  );
  return {
    id: item.id,
    reference: item.reference,
    borrower: item.borrower,
    division: item.division,
    sector: item.sector,
    exposure: Number(item.exposure),
    riskRating: item.risk_rating,
    previousRating: item.previous_rating,
    status: item.status,
    owner: item.owner.name,
    approver: item.approver.name,
    nextReview: displayDate(item.next_review_date),
    daysOnWatchlist,
    triggers: item.triggers,
    summary: item.summary,
    actionProgress: item.status === "REMOVAL_PENDING" ? 100 : item.status === "ACTIVE" ? 68 : 15,
    openActions: item.status === "REMOVAL_PENDING" ? 0 : 3,
    overdueActions: item.status === "ACTIVE" ? 1 : 0,
    lastActivity: `Case updated ${displayDate(item.updated_at.slice(0, 10))}`,
  };
};

const mapReview = (review: ApiReview): Review => ({
  id: review.id,
  caseId: review.case_id,
  borrower: review.borrower,
  owner: review.owner,
  division: review.division,
  period: new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(`${review.period}-01T00:00:00`)),
  dueDate: displayDate(review.due_date),
  dueDateValue: review.due_date,
  status: review.status,
  recommendation: review.recommendation,
  commentary: review.commentary,
});

export const api = {
  async users(): Promise<Persona[]> {
    return (await request<ApiUser[]>("/users")).map(mapUser);
  },
  async cases(userId: number): Promise<WatchCase[]> {
    return (await request<ApiCase[]>("/cases", userId)).map(mapCase);
  },
  async reviews(userId: number): Promise<Review[]> {
    return (await request<ApiReview[]>("/reviews", userId)).map(mapReview);
  },
  async createCase(userId: number, input: CaseCreateInput): Promise<WatchCase> {
    return mapCase(
      await request<ApiCase>("/cases", userId, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  },
  async transitionCase(
    userId: number,
    caseId: number,
    action: string,
    note: string,
  ): Promise<WatchCase> {
    return mapCase(
      await request<ApiCase>(`/cases/${caseId}/transition`, userId, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      }),
    );
  },
  async transitionReview(
    userId: number,
    reviewId: number,
    action: string,
    note: string,
  ): Promise<Review> {
    return mapReview(
      await request<ApiReview>(`/reviews/${reviewId}/transition`, userId, {
        method: "POST",
        body: JSON.stringify({ action, note }),
      }),
    );
  },
};
