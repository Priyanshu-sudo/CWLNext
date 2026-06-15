"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  ClipboardCheck,
  FilePlus2,
  LayoutDashboard,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { api } from "./api";
import { formatMoney, personas as demoPersonas } from "./data";
import type { CaseCreateInput, CaseStatus, Persona, Review, WatchCase } from "./types";

const statusLabel: Record<CaseStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  ACTIVE: "Active",
  RETURNED: "Returned",
  REMOVAL_PENDING: "Removal pending",
  CLOSED: "Closed",
};

type SearchParams = Record<string, string | string[] | undefined>;
export type AppView =
  | { kind: "redirect"; to: string }
  | { kind: "dashboard" }
  | { kind: "cases" }
  | { kind: "case-detail"; caseId: number }
  | { kind: "reviews" }
  | { kind: "approvals" }
  | { kind: "portfolio" }
  | { kind: "admin" };

type WorkQueueItem = {
  to: string;
  icon: React.ReactNode;
  tone: string;
  count: number;
  title: string;
  detail: string;
};

function getSingleValue(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status status-${status.toLowerCase().replaceAll("_", "-")}`}>
      <span className="status-dot" />
      {statusLabel[status as CaseStatus] ?? status.replaceAll("_", " ").toLowerCase()}
    </span>
  );
}

function getApprovalItems(caseItems: WatchCase[], persona: Persona) {
  const pendingItems = caseItems.filter(
    (item) => item.status === "PENDING_APPROVAL" || item.status === "REMOVAL_PENDING",
  );

  if (persona.role === "ADMIN") {
    return pendingItems;
  }

  if (persona.role === "APPROVER") {
    return pendingItems.filter((item) => item.division === persona.division);
  }

  return [];
}

function parseDateOnly(value: string) {
  return new Date(`${value}T00:00:00`);
}

function differenceInDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

function formatDashboardDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(value).toUpperCase();
}

function isActionableReview(review: Review) {
  return ["DUE", "DRAFT", "RETURNED"].includes(review.status);
}

function isDueSoonReview(review: Review, today: Date) {
  if (!isActionableReview(review)) {
    return false;
  }

  const daysUntilDue = differenceInDays(today, parseDateOnly(review.dueDateValue));
  return daysUntilDue >= 0 && daysUntilDue <= 7;
}

function isOverdueReview(review: Review, today: Date) {
  if (!isActionableReview(review)) {
    return false;
  }

  return differenceInDays(today, parseDateOnly(review.dueDateValue)) < 0;
}

function AppNavLink({
  href,
  icon,
  label,
  active,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  count?: number;
}) {
  return (
    <Link href={href} className={active ? "active" : undefined}>
      {icon}
      {label}
      {typeof count === "number" && count > 0 && <span className="nav-count">{count}</span>}
    </Link>
  );
}

export default function App({
  view,
  searchParams,
}: {
  view: AppView;
  searchParams: SearchParams;
}) {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>(demoPersonas);
  const [persona, setPersona] = useState<Persona>(demoPersonas[0]);
  const [caseItems, setCaseItems] = useState<WatchCase[]>([]);
  const [reviewItems, setReviewItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [roleMenu, setRoleMenu] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");

  const notify = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const refresh = useCallback(async (activePersona: Persona) => {
    setLoading(true);
    setLoadError("");
    try {
      const [nextCases, nextReviews] = await Promise.all([
        api.cases(activePersona.id),
        api.reviews(activePersona.id),
      ]);
      setCaseItems(nextCases);
      setReviewItems(nextReviews);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load application data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fallbackPersona = demoPersonas[0];

    api.users()
      .then((users) => {
        setPersonas(users);
        const active = users.find((user) => user.id === fallbackPersona.id) ?? users[0];
        setPersona(active);
        return refresh(active);
      })
      .catch(() => refresh(fallbackPersona));
  }, [refresh]);

  const switchPersona = (nextPersona: Persona) => {
    setPersona(nextPersona);
    setRoleMenu(false);
    notify(`Now viewing as ${nextPersona.name}`);
    void refresh(nextPersona);
  };

  const mutate = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation();
      notify(success);
      await refresh(persona);
    } catch (error) {
      notify(error instanceof Error ? error.message : "The action could not be completed");
    }
  };

  const approvalItems = getApprovalItems(caseItems, persona);
  const canViewApprovals = persona.role === "APPROVER" || persona.role === "ADMIN";
  const approvalCount = approvalItems.length;
  const effectiveView =
    view.kind === "approvals" && !canViewApprovals
      ? ({ kind: "redirect", to: "/dashboard" } satisfies AppView)
      : view.kind === "admin" && persona.role !== "ADMIN"
        ? ({ kind: "redirect", to: "/dashboard" } satisfies AppView)
        : view;

  useEffect(() => {
    if (effectiveView.kind === "redirect") {
      router.replace(effectiveView.to);
    }
  }, [effectiveView, router]);

  if (effectiveView.kind === "redirect") {
    return null;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">M</div>
          <div>
            <strong>MYCWL<span>Next</span></strong>
            <small>Credit Watchlist</small>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)}>
            <X size={20} />
          </button>
        </div>

        <nav>
          <small className="nav-label">WORKSPACE</small>
          <AppNavLink href="/dashboard" icon={<LayoutDashboard />} label="Overview" active={effectiveView.kind === "dashboard"} />
          <AppNavLink href="/cases" icon={<BriefcaseBusiness />} label="Watchlist cases" active={effectiveView.kind === "cases" || effectiveView.kind === "case-detail"} />
          <AppNavLink href="/reviews" icon={<CalendarCheck />} label="Monthly reviews" active={effectiveView.kind === "reviews"} />
          {canViewApprovals && (
            <AppNavLink
              href="/approvals"
              icon={<ClipboardCheck />}
              label="My approvals"
              active={effectiveView.kind === "approvals"}
              count={approvalCount}
            />
          )}
          <small className="nav-label">MANAGE</small>
          <AppNavLink href="/portfolio" icon={<CircleGauge />} label="Portfolio insights" active={effectiveView.kind === "portfolio"} />
          {persona.role === "ADMIN" && (
            <AppNavLink href="/admin" icon={<Users />} label="Administration" active={effectiveView.kind === "admin"} />
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="division-chip">
            <Building2 size={17} />
            <span>{persona.division ?? "All divisions"}</span>
          </div>
          <p>MYCWLNext <span>v0.1</span></p>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)}>
            <Menu />
          </button>
          <div className="global-search">
            <Search size={18} />
            <input aria-label="Search" placeholder="Search borrower, case ID, or owner..." />
            <kbd>Ctrl K</kbd>
          </div>
          <div className="top-actions">
            <button className="icon-button notification"><Bell size={20} /><i /></button>
            <div className="persona-wrap">
              <button className="persona-button" onClick={() => setRoleMenu(!roleMenu)}>
                <span className="avatar">{persona.initials}</span>
                <span className="persona-copy">
                  <strong>{persona.name}</strong>
                  <small>{persona.role.replace("_", " ")} / {persona.division ?? "Global"}</small>
                </span>
                <ChevronDown size={16} />
              </button>
              {roleMenu && (
                <div className="persona-menu">
                  <div className="persona-menu-head">
                    <strong>Switch persona</strong>
                    <small>Demo all 9 application roles</small>
                  </div>
                  {personas.map((item) => (
                    <button
                      key={item.id}
                      className={item.id === persona.id ? "selected" : ""}
                      onClick={() => {
                        switchPersona(item);
                      }}
                    >
                      <span className="avatar small">{item.initials}</span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.division ?? "ALL"} / {item.role.replace("_", " ")}</small>
                      </span>
                      {item.id === persona.id && <CheckCircle2 size={16} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page">
          {loadError && <div className="api-banner"><AlertTriangle size={17} /><span><strong>API unavailable.</strong> {loadError}</span><button onClick={() => void refresh(persona)}>Retry</button></div>}
          {loading && <div className="loading-bar" />}
          {effectiveView.kind === "dashboard" && (
            <Dashboard
              persona={persona}
              caseItems={caseItems}
              reviewItems={reviewItems}
              approvalCount={approvalCount}
              canViewApprovals={canViewApprovals}
            />
          )}
          {effectiveView.kind === "cases" && (
            <CasesPage
              persona={persona}
              caseItems={caseItems}
              createCase={(input) => mutate(() => api.createCase(persona.id, input), "Draft case created")}
              searchParams={searchParams}
            />
          )}
          {effectiveView.kind === "case-detail" && (
            <CaseDetail
              persona={persona}
              caseItems={caseItems}
              caseId={effectiveView.caseId}
              transition={(id, action, note) => mutate(() => api.transitionCase(persona.id, id, action, note), "Case decision recorded")}
              notify={notify}
            />
          )}
          {effectiveView.kind === "reviews" && (
            <ReviewsPage
              persona={persona}
              reviewItems={reviewItems}
              searchParams={searchParams}
              transition={(id, action) => mutate(() => api.transitionReview(persona.id, id, action, "Updated in MYCWLNext"), "Review updated")}
            />
          )}
          {effectiveView.kind === "approvals" && (
            <ApprovalsPage
              persona={persona}
              caseItems={approvalItems}
              transition={(id, action) => mutate(() => api.transitionCase(persona.id, id, action, "Decision recorded in MYCWLNext"), "Decision recorded")}
            />
          )}
          {effectiveView.kind === "portfolio" && <PortfolioPage />}
          {effectiveView.kind === "admin" && <AdminPage personas={personas} />}
        </div>
      </main>
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Dashboard({
  persona,
  caseItems,
  reviewItems,
  approvalCount,
  canViewApprovals,
}: {
  persona: Persona;
  caseItems: WatchCase[];
  reviewItems: Review[];
  approvalCount: number;
  canViewApprovals: boolean;
}) {
  const totalExposure = caseItems.reduce((sum, item) => sum + item.exposure, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueSoonReviews = reviewItems.filter((review) => isDueSoonReview(review, today));
  const overdueReviews = reviewItems.filter((review) => isOverdueReview(review, today));
  const returnedCases = caseItems.filter((item) => item.status === "RETURNED");
  const workQueueItems: WorkQueueItem[] = [];

  if (canViewApprovals) {
    workQueueItems.push({
      to: "/approvals",
      icon: <ClipboardCheck />,
      tone: "violet",
      count: approvalCount,
      title: "Review submissions",
      detail: approvalCount > 0 ? "Awaiting approval" : "No pending decisions",
    });
  }

  workQueueItems.push(
    {
      to: "/reviews?bucket=due-soon",
      icon: <CalendarCheck />,
      tone: "blue",
      count: dueSoonReviews.length,
      title: "Monthly reviews",
      detail: dueSoonReviews.length > 0 ? "Due in next 7 days" : "No reviews due in next 7 days",
    },
    {
      to: "/reviews?bucket=overdue",
      icon: <AlertTriangle />,
      tone: "amber",
      count: overdueReviews.length,
      title: "Overdue action",
      detail: overdueReviews.length > 0 ? "Requires an update" : "Nothing overdue",
    },
    {
      to: "/cases?status=RETURNED",
      icon: <FilePlus2 />,
      tone: "teal",
      count: returnedCases.length,
      title: "Returned case",
      detail: returnedCases.length > 0 ? "Changes requested" : "No returned cases",
    },
  );

  return (
    <>
      <PageHeading
        eyebrow={formatDashboardDate(new Date())}
        title={`Good evening, ${persona.name.split(" ")[0]}`}
        description={`Here is what needs attention across ${persona.division ?? "the enterprise"} today.`}
        action={<Link className="primary-button" href="/cases?create=1"><FilePlus2 size={18} />New case</Link>}
      />

      <section className="metrics-grid">
        <article className="metric-card">
          <div className="metric-icon teal"><BriefcaseBusiness /></div>
          <span>Active watchlist</span>
          <strong>{caseItems.filter((c) => c.status !== "CLOSED" && c.status !== "DRAFT").length}</strong>
          <small><b>+2</b> since last month</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon amber"><AlertTriangle /></div>
          <span>Exposure monitored</span>
          <strong>{formatMoney(totalExposure)}</strong>
          <small>Across {caseItems.length} relationships</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon blue"><CalendarCheck /></div>
          <span>Reviews due</span>
          <strong>{reviewItems.filter((review) => isActionableReview(review)).length}</strong>
          <small><em>{overdueReviews.length}</em> overdue this cycle</small>
        </article>
        <article className="metric-card">
          <div className="metric-icon violet"><ClipboardCheck /></div>
          <span>Awaiting decisions</span>
          <strong>{approvalCount}</strong>
          <small>{canViewApprovals ? "Pending items in your approval queue" : "Available only to approvers and admin"}</small>
        </article>
      </section>

      <section className="content-grid">
        <article className="panel span-two">
          <div className="panel-head">
            <div><h2>Priority cases</h2><p>Cases ranked by urgency and review date</p></div>
            <Link href="/cases">View all <span aria-hidden="true">-&gt;</span></Link>
          </div>
          <div className="case-list">
            {caseItems.slice(0, 4).map((item) => <CaseRow key={item.id} item={item} />)}
          </div>
        </article>

        <article className="panel">
          <div className="panel-head"><div><h2>Work queue</h2><p>Your next actions</p></div></div>
          <div className="queue-list">
            {workQueueItems.map((item) => <QueueItem key={item.title} {...item} />)}
          </div>
        </article>
      </section>

      <section className="content-grid lower">
        <article className="panel span-two">
          <div className="panel-head"><div><h2>Exposure by division</h2><p>Current monitored exposure</p></div><button className="text-button">Last 6 months <ChevronDown size={14} /></button></div>
          <div className="bar-chart">
            {[
              ["IB", 126.5, 91], ["GWMSI", 73.8, 58], ["PNC", 74.9, 61], ["GWMA", 31.9, 31],
            ].map(([name, value, width]) => (
              <div className="bar-row" key={String(name)}>
                <span>{name}</span><div className="bar-track"><i style={{ width: `${width}%` }} /></div><strong>${value}M</strong>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-head"><div><h2>Recent activity</h2><p>Across your portfolio</p></div></div>
          <div className="activity-list">
            <Activity initials="SM" text="Sofia approved Northstar review" time="18 min ago" />
            <Activity initials="PN" text="Priya updated an action plan" time="2 hours ago" />
            <Activity initials="EV" text="Elena requested case removal" time="4 hours ago" />
          </div>
        </article>
      </section>
    </>
  );
}

function CaseRow({ item }: { item: WatchCase }) {
  return (
    <Link className="case-row" href={`/cases/${item.id}`}>
      <div className={`division-badge division-${item.division.toLowerCase()}`}>{item.division.slice(0, 2)}</div>
      <div className="case-main">
        <strong>{item.borrower}</strong>
        <span>{item.reference} / {item.sector}</span>
      </div>
      <div className="case-value"><small>EXPOSURE</small><strong>{formatMoney(item.exposure)}</strong></div>
      <div className="case-value rating"><small>RISK RATING</small><strong>{item.riskRating.split(" - ")[0]}</strong></div>
      <StatusPill status={item.status} />
      <div className="review-date"><small>NEXT REVIEW</small><strong>{item.nextReview}</strong></div>
      <span className="row-arrow" aria-hidden="true">&gt;</span>
    </Link>
  );
}

function QueueItem({
  icon,
  tone,
  count,
  title,
  detail,
  to,
}: {
  icon: React.ReactNode;
  tone: string;
  count: number;
  title: string;
  detail: string;
  to: string;
}) {
  return (
    <Link className="queue-item" href={to}>
      <div className={`queue-icon ${tone}`}>{icon}</div>
      <div><strong>{title}</strong><span>{detail}</span></div>
      <b>{count}</b>
    </Link>
  );
}

function Activity({ initials, text, time }: { initials: string; text: string; time: string }) {
  return <div className="activity"><span className="avatar small">{initials}</span><div><strong>{text}</strong><small>{time}</small></div></div>;
}

function CasesPage({
  persona,
  caseItems,
  createCase,
  searchParams,
}: {
  persona: Persona;
  caseItems: WatchCase[];
  createCase: (input: CaseCreateInput) => Promise<void>;
  searchParams: SearchParams;
}) {
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(Boolean(getSingleValue(searchParams.create)));
  const statusFilter = getSingleValue(searchParams.status);
  const searchKey = JSON.stringify(searchParams);

  useEffect(() => {
    if (getSingleValue(searchParams.create)) {
      setShowCreate(true);
    }
  }, [searchKey, searchParams]);

  const filtered = caseItems.filter((item) => {
    const matchesQuery = `${item.borrower} ${item.reference}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = !statusFilter || item.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const description = statusFilter === "RETURNED"
    ? `${filtered.length} returned cases requiring updates`
    : `${persona.role === "ADMIN" ? "Enterprise" : persona.division} portfolio / ${filtered.length} relationships`;

  return (
    <>
      <PageHeading
        title="Watchlist cases"
        description={description}
        action={persona.role === "CASE_OWNER" ? <button className="primary-button" onClick={() => setShowCreate(true)}><FilePlus2 size={18} />New case</button> : undefined}
      />
      <div className="toolbar">
        <div className="table-search"><Search size={17} /><input placeholder="Search cases..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
        <button className="filter-button">{statusFilter ?? "All statuses"} <ChevronDown size={15} /></button>
        <button className="filter-button">All ratings <ChevronDown size={15} /></button>
      </div>
      <div className="table-panel">
        <table>
          <thead><tr><th>Borrower</th><th>Division</th><th>Exposure</th><th>Risk</th><th>Status</th><th>Next review</th><th>Owner</th></tr></thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td><Link href={`/cases/${item.id}`}><strong>{item.borrower}</strong><small>{item.reference} / {item.sector}</small></Link></td>
                <td><span className="division-tag">{item.division}</span></td>
                <td><strong>{formatMoney(item.exposure)}</strong></td>
                <td><span className={`risk-number risk-${item.riskRating.charAt(0)}`}>{item.riskRating.charAt(0)}</span></td>
                <td><StatusPill status={item.status} /></td>
                <td>{item.nextReview}</td>
                <td>{item.owner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showCreate && <CreateCaseModal persona={persona} close={() => setShowCreate(false)} createCase={createCase} />}
    </>
  );
}

function CreateCaseModal({
  persona,
  close,
  createCase,
}: {
  persona: Persona;
  close: () => void;
  createCase: (input: CaseCreateInput) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<CaseCreateInput>({
    borrower: "",
    division: persona.division ?? "PNC",
    sector: "Industrials",
    exposure: 0,
    risk_rating: "6 - Special mention",
    previous_rating: "5 - Acceptable",
    summary: "",
    triggers: [],
    next_review_date: "2026-07-15",
  });

  const update = <K extends keyof CaseCreateInput>(key: K, value: CaseCreateInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    setSubmitting(true);
    await createCase(form);
    setSubmitting(false);
    close();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head"><div><span className="eyebrow">NEW WATCHLIST CASE</span><h2>Create case</h2></div><button className="icon-button" onClick={close}><X /></button></div>
        <div className="steps"><span className="active">1</span><i /><span className={step >= 2 ? "active" : ""}>2</span><i /><span className={step >= 3 ? "active" : ""}>3</span></div>
        {step === 1 && <div className="form-grid"><label className="wide">Borrower name<input placeholder="Legal entity name" value={form.borrower} onChange={(event) => update("borrower", event.target.value)} /></label><label>Division<select value={form.division} disabled><option>PNC</option><option>GWMA</option><option>GWMSI</option><option>IB</option></select></label><label>Sector<select value={form.sector} onChange={(event) => update("sector", event.target.value)}><option>Industrials</option><option>Energy</option><option>Healthcare</option><option>Real estate</option></select></label><label>Exposure (USD)<input type="number" placeholder="0" value={form.exposure || ""} onChange={(event) => update("exposure", Number(event.target.value))} /></label><label>Current risk rating<select value={form.risk_rating} onChange={(event) => update("risk_rating", event.target.value)}><option>5 - Acceptable</option><option>6 - Special mention</option><option>7 - Substandard</option></select></label></div>}
        {step === 2 && <div className="form-grid"><label className="wide">Watchlist rationale<textarea rows={5} placeholder="Describe deterioration, evidence, and materiality..." value={form.summary} onChange={(event) => update("summary", event.target.value)} /></label><label className="wide">Early warning indicators<input placeholder="e.g. Covenant breach, liquidity pressure" value={form.triggers.join(", ")} onChange={(event) => update("triggers", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} /></label><label>Next review<input type="date" value={form.next_review_date} onChange={(event) => update("next_review_date", event.target.value)} /></label><label>Proposed approver<input value="Division approver" readOnly /></label></div>}
        {step === 3 && <div className="review-box"><ShieldCheck size={38} /><h3>Ready to create draft</h3><p>{form.borrower} will be created with {formatMoney(form.exposure)} exposure and routed to the {form.division} approver.</p><div><span>Owner</span><strong>{persona.name}</strong></div><div><span>Division</span><strong>{form.division}</strong></div></div>}
        <div className="modal-actions"><button className="secondary-button" onClick={step === 1 ? close : () => setStep(step - 1)}>{step === 1 ? "Cancel" : "Back"}</button><button className="primary-button" disabled={submitting || (step === 1 && (!form.borrower || !form.exposure)) || (step === 2 && form.summary.length < 20)} onClick={() => { if (step < 3) setStep(step + 1); else void submit(); }}>{submitting ? "Creating..." : step === 3 ? "Create draft" : "Continue"}</button></div>
      </div>
    </div>
  );
}

function CaseDetail({
  persona,
  caseItems,
  caseId,
  transition,
  notify,
}: {
  persona: Persona;
  caseItems: WatchCase[];
  caseId: number;
  transition: (id: number, action: string, note: string) => Promise<void>;
  notify: (message: string) => void;
}) {
  const router = useRouter();
  const item = caseItems.find((candidate) => candidate.id === caseId);

  useEffect(() => {
    if (!item) {
      router.replace("/cases");
    }
  }, [item, router]);

  if (!item) {
    return null;
  }

  const canApprove = persona.role === "APPROVER" && persona.division === item.division;

  return (
    <>
      <button className="back-button" onClick={() => router.back()}>&lt;- Back to cases</button>
      <div className="detail-heading">
        <div className={`division-badge large division-${item.division.toLowerCase()}`}>{item.division.slice(0, 2)}</div>
        <div><span>{item.reference}</span><h1>{item.borrower}</h1><p>{item.sector} / {item.division} division</p></div>
        <StatusPill status={item.status} />
        <div className="detail-actions">
          {canApprove && item.status === "PENDING_APPROVAL" && <><button className="secondary-button" onClick={() => void transition(item.id, "return", "Additional evidence required")}>Return</button><button className="primary-button" onClick={() => void transition(item.id, "approve", "Approved by division approver")}>Approve</button></>}
          {canApprove && item.status === "REMOVAL_PENDING" && <><button className="secondary-button" onClick={() => void transition(item.id, "decline_removal", "Continue monitoring")}>Decline removal</button><button className="primary-button" onClick={() => void transition(item.id, "approve_removal", "Exit criteria satisfied")}>Approve removal</button></>}
          {persona.name === item.owner && ["DRAFT", "RETURNED"].includes(item.status) && <button className="primary-button" onClick={() => void transition(item.id, "submit", "Submitted for approval")}>Submit case</button>}
          {persona.name === item.owner && item.status === "ACTIVE" && <button className="primary-button" onClick={() => notify("Open Monthly reviews to update this case")}>Start monthly review</button>}
        </div>
      </div>
      <div className="detail-grid">
        <section className="detail-main">
          <article className="panel">
            <div className="panel-head"><div><h2>Credit overview</h2><p>Current watchlist assessment</p></div><button className="text-button">Edit assessment</button></div>
            <div className="overview-grid">
              <div><small>TOTAL EXPOSURE</small><strong>{formatMoney(item.exposure)}</strong></div>
              <div><small>CURRENT RISK RATING</small><strong className="negative">{item.riskRating}</strong></div>
              <div><small>PREVIOUS RATING</small><strong>{item.previousRating}</strong></div>
              <div><small>DAYS ON WATCHLIST</small><strong>{item.daysOnWatchlist} days</strong></div>
            </div>
            <div className="narrative"><h3>Watchlist rationale</h3><p>{item.summary}</p><div className="trigger-list">{item.triggers.map((trigger) => <span key={trigger}><AlertTriangle size={14} />{trigger}</span>)}</div></div>
          </article>
          <article className="panel">
            <div className="panel-head"><div><h2>Remediation plan</h2><p>{item.openActions} open actions / {item.overdueActions} overdue</p></div><button className="secondary-button small-button">Add action</button></div>
            <div className="progress-head"><span>Overall progress</span><strong>{item.actionProgress}%</strong></div>
            <div className="progress"><i style={{ width: `${item.actionProgress}%` }} /></div>
            <div className="action-list">
              <div><CheckCircle2 className="done" /><span><strong>Receive updated 13-week cash flow</strong><small>Completed Jun 8 by {item.owner}</small></span></div>
              <div><span className="open-check" /><span><strong>Validate covenant cure plan</strong><small>Due Jun 16 / Credit Risk</small></span><StatusPill status="ACTIVE" /></div>
              <div><AlertTriangle className="overdue" /><span><strong>Obtain sponsor support confirmation</strong><small>Due Jun 10 / 3 days overdue</small></span><StatusPill status="RETURNED" /></div>
            </div>
          </article>
        </section>
        <aside className="detail-side">
          <article className="panel">
            <h2>Case ownership</h2>
            <div className="owner-card"><span className="avatar">PN</span><div><small>CASE OWNER</small><strong>{item.owner}</strong></div></div>
            <div className="owner-card"><span className="avatar muted">MR</span><div><small>APPROVER</small><strong>{item.approver}</strong></div></div>
            <hr />
            <div className="key-value"><span>Next review</span><strong>{item.nextReview}, 2026</strong></div>
            <div className="key-value"><span>Review frequency</span><strong>Monthly</strong></div>
          </article>
          <article className="panel">
            <div className="panel-head"><div><h2>Timeline</h2></div><button className="text-button">Full history</button></div>
            <div className="timeline">
              <div><i /><span><strong>{item.lastActivity}</strong><small>{item.owner}</small></span></div>
              <div><i /><span><strong>May review approved</strong><small>{item.approver} / May 21</small></span></div>
              <div><i /><span><strong>Added to watchlist</strong><small>Mar 11, 2026</small></span></div>
            </div>
          </article>
        </aside>
      </div>
    </>
  );
}

function ReviewsPage({
  persona,
  reviewItems,
  searchParams,
  transition,
}: {
  persona: Persona;
  reviewItems: Review[];
  searchParams: SearchParams;
  transition: (id: number, action: string) => Promise<void>;
}) {
  const bucket = getSingleValue(searchParams.bucket);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visible = reviewItems.filter((review) => {
    if (bucket === "due-soon") {
      return isDueSoonReview(review, today);
    }

    if (bucket === "overdue") {
      return isOverdueReview(review, today);
    }

    return true;
  });

  const description = bucket === "due-soon"
    ? `${visible.length} monthly reviews due in the next 7 days.`
    : bucket === "overdue"
      ? `${visible.length} overdue monthly reviews requiring attention.`
      : "Monitor periodic assessments, recommendations, and attestations.";

  return (
    <>
      <PageHeading title="Monthly reviews" description={description} />
      <div className="review-cards">
        {visible.map((review) => (
          <Link href={`/cases/${review.caseId}`} className="review-card" key={review.id}>
            <div><CalendarCheck /><StatusPill status={review.status} /></div>
            <span>{review.period} / Due {review.dueDate}</span>
            <h3>{review.borrower}</h3>
            <p>{review.recommendation}</p>
            <footer>
              <span className="avatar small">{review.owner.split(" ").map((part) => part[0]).join("")}</span>
              <strong>{review.owner}</strong>
              {persona.name === review.owner && ["DUE", "DRAFT", "RETURNED"].includes(review.status) && <button className="text-button" onClick={(event) => { event.preventDefault(); void transition(review.id, review.status === "DUE" ? "start" : "submit"); }}>{review.status === "DUE" ? "Start" : "Submit"}</button>}
              {persona.role === "APPROVER" && persona.division === review.division && review.status === "PENDING_APPROVAL" && <span className="review-decisions"><button className="text-button danger" onClick={(event) => { event.preventDefault(); void transition(review.id, "return"); }}>Return</button><button className="text-button" onClick={(event) => { event.preventDefault(); void transition(review.id, "approve"); }}>Approve</button></span>}
              <span>Open case -&gt;</span>
            </footer>
          </Link>
        ))}
      </div>
    </>
  );
}

function ApprovalsPage({
  persona,
  caseItems,
  transition,
}: {
  persona: Persona;
  caseItems: WatchCase[];
  transition: (id: number, action: string) => Promise<void>;
}) {
  const isReadOnly = persona.role === "ADMIN";

  return (
    <>
      <PageHeading title="Approval queue" description={isReadOnly ? "Enterprise-wide pending decisions in read-only mode." : "Independent decisions requiring your attention."} />
      <div className="approval-stack">
        {caseItems.map((item) => (
          <article className="panel approval-card" key={item.id}>
            <div className={`division-badge division-${item.division.toLowerCase()}`}>{item.division.slice(0, 2)}</div>
            <div><span>{item.reference} / {item.division}</span><h3>{item.borrower}</h3><p>{item.summary}</p></div>
            <div className="approval-meta"><small>DECISION</small><strong>{item.status === "REMOVAL_PENDING" ? "Watchlist removal" : "Monthly review"}</strong><StatusPill status={item.status} /></div>
            <div className="approval-buttons"><button className="secondary-button" disabled={isReadOnly} onClick={() => void transition(item.id, item.status === "REMOVAL_PENDING" ? "decline_removal" : "return")}>{item.status === "REMOVAL_PENDING" ? "Decline" : "Return"}</button><button className="primary-button" disabled={isReadOnly} onClick={() => void transition(item.id, item.status === "REMOVAL_PENDING" ? "approve_removal" : "approve")}>Approve</button></div>
          </article>
        ))}
      </div>
    </>
  );
}

function PortfolioPage() {
  return (
    <>
      <PageHeading title="Portfolio insights" description="Enterprise concentration and watchlist movement." />
      <section className="content-grid">
        <article className="panel span-two"><div className="panel-head"><div><h2>Risk migration</h2><p>Relationship count by internal rating</p></div></div><div className="migration"><div><span>5</span><i style={{ height: "38%" }} /><b>4</b></div><div><span>6</span><i style={{ height: "78%" }} /><b>9</b></div><div><span>7</span><i style={{ height: "58%" }} /><b>6</b></div><div><span>8</span><i style={{ height: "25%" }} /><b>2</b></div></div></article>
        <article className="panel"><div className="panel-head"><div><h2>Top warning indicators</h2><p>Active case signals</p></div></div><div className="indicator-list"><div><span>Liquidity pressure</span><b>7</b></div><div><span>Covenant breach</span><b>5</b></div><div><span>Revenue decline</span><b>4</b></div><div><span>Management change</span><b>3</b></div></div></article>
      </section>
    </>
  );
}

function AdminPage({ personas }: { personas: Persona[] }) {
  return (
    <>
      <PageHeading title="Administration" description="Manage personas, divisions, workflow settings, and reference data." action={<button className="primary-button"><Settings size={18} />Workflow settings</button>} />
      <div className="admin-grid">
        {personas.map((persona) => <article className="panel admin-person" key={persona.id}><span className="avatar">{persona.initials}</span><div><h3>{persona.name}</h3><p>{persona.division ?? "Enterprise"} / {persona.role.replace("_", " ")}</p></div><span className="active-user">Active</span></article>)}
      </div>
    </>
  );
}
