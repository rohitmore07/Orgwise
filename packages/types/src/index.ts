// orgwise shared domain contracts. Phase 2 introduces the core domain: identity, organization and workforce…
// records plus the pagination / dashboard / import shapes both applications agree on. The API is the source of…

/** Primitive values representable in JSON. */
export type JsonPrimitive = string | number | boolean | null;

/** Any JSON-serializable value. */
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Opaque identifier used across orgwise entities. */
export type EntityId = string;

/** ISO-8601 timestamp. */
export type IsoDate = string;

/** Shape returned by `GET /api/health`. */
export interface HealthStatus {
  /** `degraded` when a backing dependency (Postgres) is unreachable. */
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: IsoDate;
  uptimeSeconds: number;
  /** Database connectivity: `up` when `SELECT 1` succeeds. */
  db: 'up' | 'down';
}

/** Brand tone used by the department breakdown visualization. */
export type DepartmentTone = 'indigo' | 'cyan' | 'emerald' | 'violet';

/** One trend series rendered as a sparkline. */
export interface SparkSeries {
  label: string;
  value: number;
  suffix: string;
  decimals: number;
  data: number[];
}
// Live workforce-signal snapshot served by `GET /api/signals/live`. Deterministic baseline data (no DB…
// dependency yet) with real timestamps and a slowly ticking signal count so the dashboard reads as live.
export interface LiveSignalsSnapshot {
  generatedAt: IsoDate;
  uptimeSeconds: number;
  /** Composite health score, 0–100. */
  healthScore: number;
  /** Change vs. previous period, in points. */
  healthDelta: number;
  headcount: number;
  engagementPercent: number;
  flightRiskPercent: number;
  /** Signals received in the current rolling window. */
  signalsTotal: number;
  signalsBySource: Array<{ source: string; count: number }>;
  modelRefreshedAt: IsoDate;
  departments: Array<{ name: string; pct: number; tone: DepartmentTone }>;
  /** Attrition risk per heat-map cell, 0..1. */
  heatMap: number[];
  spark: SparkSeries[];
}
// Standard API response envelope. Every orgwise API response is wrapped by the global response interceptor…
// into this shape so clients rely on a single, stable contract: `{ success, message, data, timestamp }`.
export interface ApiResponse<T> {
  success: true;
  /** Human-readable summary, e.g. `OK`. */
  message: string;
  data: T;
  /** ISO-8601 timestamp of when the response was produced. */
  timestamp: IsoDate;
}

/** Error payload produced by the global exception filter. */
export interface ApiErrorResponse {
  success: false;
  message: string;
  data: null;
  /** ISO-8601 timestamp of when the error was produced. */
  timestamp: IsoDate;
  /** HTTP status code. */
  statusCode: number;
  /** Stable error category, e.g. `Bad Request`. */
  error: string;
  /** Request path that produced the error. */
  path: string;
  /** Correlation id — matches the server-side `X-Request-Id` header. */
  requestId?: string;
  /** Optional machine-readable detail (e.g. DTO validation messages). */
  details?: unknown;
}
// ───────────────────────────────────────────────────────────────────────────── Domain enums (mirrors of the…
// Prisma enums) ─────────────────────────────────────────────────────────────────────────────

/** Platform access roles. */
export type Role = 'admin' | 'manager' | 'viewer';

/** Employment lifecycle state. */
export type EmployeeStatus = 'active' | 'on_leave' | 'probation' | 'terminated';

/** Gender identity (self-reported). */
export type Gender = 'female' | 'male' | 'non_binary' | 'prefer_not_to_say';

/** Outcome of a CSV bulk import. */
export type ImportStatus = 'completed' | 'partial' | 'failed' | 'rolled_back';
// ───────────────────────────────────────────────────────────────────────────── Identity & organization…
// ─────────────────────────────────────────────────────────────────────────────

/** Platform account with RBAC role. */
export interface User {
  id: EntityId;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  /** Linked employee profile id, when claimed. */
  employeeId?: EntityId | null;
}

/** Organizational unit with hierarchy + assigned manager. */
export interface Department {
  id: EntityId;
  name: string;
  description?: string | null;
  isActive: boolean;
  parentId?: EntityId | null;
  /** Id of the manager user whose RBAC scope includes this department. */
  managerUserId?: EntityId | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/** Lightweight manager identity embedded in department listings. */
export type DepartmentManager = Pick<User, 'id' | 'name' | 'email' | 'role'>;

/** Department joined with aggregate info for listing. */
export interface DepartmentSummary extends Department {
  manager?: DepartmentManager | null;
  parent?: Pick<Department, 'id' | 'name'> | null;
  children?: Array<Pick<Department, 'id' | 'name'>>;
  teamCount: number;
  employeeCount: number;
}

/** Sub-unit of a department. */
export interface Team {
  id: EntityId;
  name: string;
  description?: string | null;
  isActive: boolean;
  departmentId: EntityId;
  leadEmployeeId?: EntityId | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/** Team joined with parent department + aggregate info. */
export interface TeamSummary extends Team {
  department?: Pick<Department, 'id' | 'name'> | null;
  leadEmployee?: Pick<Employee, 'id' | 'firstName' | 'lastName'> | null;
  employeeCount: number;
}
// ───────────────────────────────────────────────────────────────────────────── Workforce…
// ─────────────────────────────────────────────────────────────────────────────

/** Employee record — the core workforce domain. */
export interface Employee {
  id: EntityId;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  jobTitle: string;
  gender: Gender;
  dateOfBirth?: IsoDate | null;
  hiredAt: IsoDate;
  status: EmployeeStatus;
  isActive: boolean;
  departmentId: EntityId;
  teamId?: EntityId | null;
  managerId?: EntityId | null;
  userId?: EntityId | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  /** Set when the record is soft-deleted; null while active. */
  deletedAt?: IsoDate | null;
  // ── Analytics & engagement profile (Phase 4) ───────────────────────────── These mirror the IBM HR-style…
  // dimensions used by the analytics engine. All are optional: records created before Phase 4 or via minimal…
  /** Left the workforce (observed attrition event). */
  attrition?: boolean;
  /** When the attrition event occurred (null while employed). */
  attritionDate?: IsoDate | null;
  /** Monthly income in USD — gated to admin/manager roles in API views. */
  monthlyIncome?: number | null;
  /** 1 (low) – 4 (high). */
  jobSatisfaction?: number | null;
  /** 1 (low) – 4 (high). */
  environmentSatisfaction?: number | null;
  /** 1 (low) – 4 (high). */
  relationshipSatisfaction?: number | null;
  /** 1 (low) – 4 (high). */
  workLifeBalance?: number | null;
  /** Works beyond standard hours. */
  overTime?: boolean | null;
  /** 1 (low) – 4 (high). */
  performanceRating?: number | null;
  /** 1 (below) – 5 (doctorate). */
  education?: number | null;
  /** e.g. Life Sciences, Marketing, Technical Degree. */
  educationField?: string | null;
  /** 1 (entry) – 5 (executive). */
  jobLevel?: number | null;
  yearsAtCompany?: number | null;
  yearsInCurrentRole?: number | null;
  yearsSinceLastPromotion?: number | null;
  yearsWithCurrManager?: number | null;
  totalWorkingYears?: number | null;
  distanceFromHome?: number | null;
  maritalStatus?: string | null;
  businessTravel?: string | null;
  numCompaniesWorked?: number | null;
  trainingTimesLastYear?: number | null;
  percentSalaryHike?: number | null;
  stockOptionLevel?: number | null;
}

/** Employee joined with org context for listings and detail views. */
export interface EmployeeView extends Employee {
  department?: Pick<Department, 'id' | 'name'> | null;
  team?: Pick<Team, 'id' | 'name'> | null;
  manager?: Pick<Employee, 'id' | 'firstName' | 'lastName' | 'email'> | null;
}
// ───────────────────────────────────────────────────────────────────────────── Pagination…
// ─────────────────────────────────────────────────────────────────────────────

/** Paged list payload returned by list endpoints. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
// ───────────────────────────────────────────────────────────────────────────── Imports…
// ─────────────────────────────────────────────────────────────────────────────

/** One row's validation outcome. */
export interface ImportRowError {
  row: number;
  employeeCode?: string | null;
  email?: string | null;
  errors: string[];
}

/** Result of a CSV bulk import. */
export interface ImportHistory {
  id: EntityId;
  fileName: string;
  /** employees | hiring */
  type?: 'employees' | 'hiring' | null;
  /** Optional user-provided batch name. */
  label?: string | null;
  status: ImportStatus;
  totalRows: number;
  successCount: number;
  /** Rows updated in place (duplicateStrategy = update). */
  updatedCount?: number;
  failedCount: number;
  duplicateCount: number;
  errorReport?: ImportRowError[] | null;
  importedByUserId: EntityId;
  createdAt: IsoDate;
  /** Processing time in milliseconds. */
  durationMs?: number | null;
}

/** Import record joined with the actor's identity. */
export interface ImportHistoryView extends ImportHistory {
  importedBy?: Pick<User, 'id' | 'name' | 'email'> | null;
}

/** How the importer treats rows that collide with existing records. */
export type DuplicateStrategy = 'skip' | 'fail' | 'update';

/** One row shown on the import staging (preview) screen. */
export interface ImportPreviewRow {
  row: number;
  employeeCode: string | null;
  email: string | null;
  name: string | null;
  department: string | null;
  team: string | null;
  status: 'valid' | 'invalid';
  errors: string[];
}

/** Dry-run result — nothing is written to the database. */
export interface ImportPreview {
  type: 'employees' | 'hiring';
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateCount: number;
  /** Managers that will be auto-provisioned when the import is confirmed. */
  managersProvisioned: number;
  columnMatch: {
    matched: number;
    total: number;
    aliased: string[];
    missing: string[];
  };
  previewRows: ImportPreviewRow[];
}
// ───────────────────────────────────────────────────────────────────────────── Audit trail…
// ─────────────────────────────────────────────────────────────────────────────

// Stable list of audited actions — the single source of truth. `AuditAction` is derived from it so filters and…
// the union can never drift.
export const AUDIT_ACTIONS = [
  'create',
  'update',
  'delete',
  'restore',
  'role_change',
  'import',
] as const;

/** State-changing operations recorded in the audit trail. */
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
// Stable list of audited entity types — single source of truth; the `AuditEntityType` union is derived from it.
export const AUDIT_ENTITY_TYPES = ['user', 'department', 'team', 'employee', 'import'] as const;

/** Entities that can be audited. */
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** One audit trail entry, joined with the actor's identity. */
export interface AuditLogView {
  id: EntityId;
  actorUserId?: EntityId | null;
  actor?: Pick<User, 'id' | 'name' | 'email'> | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: EntityId | null;
  details?: JsonValue | null;
  ipAddress?: string | null;
  createdAt: IsoDate;
}

/** One item in the topbar notifications feed. */
export interface NotificationItem {
  id: string;
  type: 'import' | 'audit';
  title: string;
  description: string;
  createdAt: IsoDate;
  /** Optional workspace route the notification deep-links to. */
  link?: string;
  severity?: 'info' | 'success' | 'warning' | 'danger';
}
// ───────────────────────────────────────────────────────────────────────────── Dashboard…
// ─────────────────────────────────────────────────────────────────────────────

/** One slice for distribution charts. */
export interface DistributionSlice {
  name: string;
  value: number;
}
// Optional dashboard slice filters — applied server-side so scoping stays authoritative.…
// `departmentId`/`teamId` for managers are intersected with their assigned scope.
export interface DashboardFilters {
  departmentId?: string;
  teamId?: string;
  status?: EmployeeStatus;
  gender?: Gender;
  // ── Phase 4 analytics dimensions ──────────────────────────────────────────
  jobTitle?: string;
  overTime?: boolean;
  attrition?: boolean;
  /** 1–4 satisfaction level. */
  jobSatisfaction?: number;
  /** 1–4 satisfaction level (drill-down filter for the engagement charts). */
  environmentSatisfaction?: number;
  /** 1–4 satisfaction level (drill-down filter for the engagement charts). */
  relationshipSatisfaction?: number;
  /** 1–4 work-life balance level (drill-down filter for the engagement charts). */
  workLifeBalance?: number;
  ageGroup?: AgeGroup;
  tenureGroup?: TenureGroup;
  /** 1–5 education level. */
  education?: number;
}

/** Aggregated KPI + distribution payload for the analytics dashboard. */
export interface DashboardOverview {
  kpis: {
    totalEmployees: number;
    activeEmployees: number;
    totalDepartments: number;
    totalManagers: number;
    totalTeams: number;
  };
  /** Department options for the filter UI (id + name), already scope-aware. */
  departments: Array<Pick<Department, 'id' | 'name'>>;
  departmentDistribution: DistributionSlice[];
  employeeStatus: DistributionSlice[];
  genderDistribution: DistributionSlice[];
  recentHires: EmployeeView[];
}
// ───────────────────────────────────────────────────────────────────────────── Analytics (Phase 4)…
// ─────────────────────────────────────────────────────────────────────────────

/** Age buckets derived from `dateOfBirth`. */
export type AgeGroup = '<25' | '25-34' | '35-44' | '45-54' | '55+';

/** Tenure buckets derived from `hiredAt` (years). */
export type TenureGroup = '<1' | '1-2' | '3-5' | '6-10' | '10+';

/** Label + order for the age-bucket axis. */
export const AGE_GROUPS: AgeGroup[] = ['<25', '25-34', '35-44', '45-54', '55+'];

/** Label + order for the tenure-bucket axis. */
export const TENURE_GROUPS: TenureGroup[] = ['<1', '1-2', '3-5', '6-10', '10+'];

/** Satisfaction dimensions used by the engagement views. */
export type SatisfactionDimension =
  'jobSatisfaction' | 'environmentSatisfaction' | 'relationshipSatisfaction' | 'workLifeBalance';

/** Workforce-overview KPIs. `null` = not calculable from the current dataset. */
export interface AnalyticsKpis {
  totalEmployees: number;
  activeEmployees: number;
  /** Observed attrition rate (0–1), null when no records carry attrition data. */
  attritionRate: number | null;
  averageTenureYears: number | null;
  averageAge: number | null;
  /** Gated to admin/manager roles. */
  averageMonthlyIncome: number | null;
  overtimeRate: number | null;
  /** 1–4. */
  averagePerformanceRating: number | null;
  totalDepartments: number;
  totalManagers: number;
  totalTeams: number;
  /** True when trends require history the dataset does not contain. */
  snapshot: boolean;
}

/** One attrition grouping: headcount + observed leavers + rate. */
export interface AttritionSlice {
  name: string;
  headcount: number;
  attritionCount: number;
  /** 0–1, null when the slice has no attrition data. */
  attritionRate: number | null;
}

/** Attrition views answering "where is retention risk concentrated?". */
export interface AttritionBreakdown {
  byDepartment: AttritionSlice[];
  byJobRole: AttritionSlice[];
  byAgeGroup: AttritionSlice[];
  byTenure: AttritionSlice[];
  byOverTime: AttritionSlice[];
  byJobSatisfaction: AttritionSlice[];
}

/** Engagement & culture views — distributions + averages per dimension. */
export interface EngagementData {
  jobSatisfaction: DistributionSlice[];
  environmentSatisfaction: DistributionSlice[];
  relationshipSatisfaction: DistributionSlice[];
  workLifeBalance: DistributionSlice[];
  averageJobSatisfaction: number | null;
  averageWorkLifeBalance: number | null;
  overtimeRate: number | null;
}

/** Workforce-composition views. */
export interface CompositionData {
  department: DistributionSlice[];
  jobRole: DistributionSlice[];
  gender: DistributionSlice[];
  age: DistributionSlice[];
  education: DistributionSlice[];
  tenure: DistributionSlice[];
}

/** Tone of a generated insight card. */
export type InsightSeverity = 'positive' | 'attention' | 'neutral';
// A deterministic, data-derived observation. Insights describe observed patterns and correlations from the…
// current dataset — never predictions or causal claims.
export interface WorkforceInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  body: string;
  /** Where the "investigate" action takes the user (e.g. the explorer). */
  drillDown?: {
    path: string;
    params: Record<string, string>;
  };
}

/** Deterministic executive summary computed from the current filter state. */
export interface ExecutiveSummary {
  /** Overall workforce-health read, derived from observed metrics. */
  status: 'healthy' | 'stable' | 'attention';
  headline: string;
  /** Concise attention areas (top observed patterns). */
  keyAreas: string[];
  updatedAt: IsoDate;
}

/** One department row in the comparison view. */
export interface DepartmentComparison {
  departmentId: EntityId;
  name: string;
  headcount: number;
  attritionRate: number | null;
  averageTenureYears: number | null;
  /** Gated to admin/manager roles. */
  averageMonthlyIncome: number | null;
  overtimeRate: number | null;
  averageJobSatisfaction: number | null;
  averagePerformanceRating: number | null;
}

/** Talent / hiring view — quality-of-hire proxies computable from the dataset. */
export interface TalentData {
  /** Hires in the last 12 months. */
  recentHires: number;
  /** Employees hired in the last 12 months, grouped by department. */
  hiresByDepartment: DistributionSlice[];
  /** Quality-of-hire proxy: performance rating distribution of hires in the last 24 months. */
  recentHirePerformance: DistributionSlice[];
  /** Average performance rating of recent (≤24 months) hires, 1–4. */
  averageRecentHireRating: number | null;
  /** Observed attrition among employees with <1 year tenure (early attrition). */
  earlyAttrition: {
    headcount: number;
    attritionCount: number;
    /** 0–1, null when the slice has no attrition data. */
    attritionRate: number | null;
  };
  /** Hiring-pipeline metrics computed from `HiringRecord` rows. Optional —
   * older API builds do not include it; the UI must tolerate its absence. */
  pipeline?: HiringPipelineData;
  /** PRD talent metrics the current dataset cannot support (dynamic). */
  unavailable: string[];
}

/** Hiring-pipeline metrics (time-to-hire, cost-per-hire, offer acceptance). */
export interface HiringPipelineData {
  /** Requisitions still open or in review. */
  openRequisitions: number;
  /** Requisitions with an accepted offer (hired). */
  filledRequisitions: number;
  /** Offers sent (decided: accepted or declined). */
  offersSent: number;
  /** Avg calendar days from requisition opened → offer accepted (hired rows only). */
  averageTimeToHireDays: number | null;
  /** Avg sourcing + recruiting cost in USD (hired rows with cost data). */
  averageCostPerHire: number | null;
  /** 0–1 — accepted ÷ (accepted + declined) offers. */
  offerAcceptanceRate: number | null;
}

/** Dataset-health indicator — analytics quality depends on data quality. */
export interface DataQuality {
  totalRecords: number;
  /** Records with no critical missing fields. */
  validRecords: number;
  /** 0–100 readiness score. */
  readinessPercent: number;
  missingFields: Array<{ field: string; label: string; count: number }>;
  duplicateRecords: number;
  deletedRecords: number;
  lastImport: {
    id: EntityId;
    fileName: string;
    status: ImportStatus;
    totalRows: number;
    successCount: number;
    failedCount: number;
    createdAt: IsoDate;
  } | null;
}

/** The complete Phase-4 analytics payload for one filter state. */
export interface AnalyticsOverview {
  kpis: AnalyticsKpis;
  /** Scope-aware department filter options. */
  departments: Array<Pick<Department, 'id' | 'name'>>;
  attrition: AttritionBreakdown;
  engagement: EngagementData;
  talent: TalentData;
  composition: CompositionData;
  insights: WorkforceInsight[];
  executiveSummary: ExecutiveSummary;
  dataQuality: DataQuality;
}

/** Filter-option lists for the global analytics filter bar. */
export interface FilterOptions {
  departments: Array<Pick<Department, 'id' | 'name'>>;
  jobTitles: string[];
  ageGroups: AgeGroup[];
  tenureGroups: TenureGroup[];
  educationLevels: Array<{ value: number; label: string }>;
}

/** One node in the organization hierarchy tree. */
export interface OrgHierarchyNode {
  id: string;
  type: 'department' | 'team' | 'employee';
  name: string;
  subtitle?: string | null;
  children: OrgHierarchyNode[];
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    status: EmployeeStatus;
    departmentId: EntityId;
  } | null;
}

/** Organization hierarchy payload (departments → teams → employees). */
export interface OrgHierarchy {
  nodes: OrgHierarchyNode[];
  totalEmployees: number;
}
// ───────────────────────────────────────────────────────────────────────────── AI Copilot (Phase 5)…
// ─────────────────────────────────────────────────────────────────────────────

/** One action link surfaced with a copilot answer (drives users into the app). */
export interface CopilotDeepLink {
  label: string;
  href: string;
}

/** Where an answer came from — grounding + provenance for trust. */
export interface CopilotProvenance {
  source: string;
  /** Analytics tool that grounded the answer. */
  toolUsed?: string;
  /** Number of records the tool analyzed. */
  recordsAnalyzed?: number;
  lastImportedAt?: IsoDate;
  /** Which LLM provider/model actually served the answer (fallback visibility). */
  provider?: string;
  model?: string;
}

/** Copilot answer for one chat turn. */
export interface CopilotResponse {
  conversationId: EntityId;
  /** Markdown answer — structured, grounded, deterministic-sourced. */
  answer: string;
  /** Action links (dashboard/explorer/profile) the user can click. */
  deepLinks: CopilotDeepLink[];
  provenance: CopilotProvenance;
  /** Explicit dataset-limitation notes instead of fabricated metrics. */
  limitations: string[];
  /** Deterministic follow-up questions for this answer. */
  suggestions: string[];
  /** Raw structured data returned by tool for Generative UI rendering. */
  toolData?: unknown;
  createdAt: IsoDate;
}

/** Request body for `POST /ai/copilot/chat`. */
export interface CopilotChatRequest {
  /** Omit to start a new conversation. */
  conversationId?: EntityId;
  message: string;
}

/** One stored copilot message (conversation history). */
export interface CopilotMessageView {
  id: EntityId;
  role: 'user' | 'assistant';
  content: string;
  toolName?: string | null;
  toolData?: unknown;
  createdAt: IsoDate;
}

/** Real-time SSE streaming events emitted by the Copilot API. */
export type CopilotStreamEvent =
  | { type: 'token'; content: string }
  | { type: 'tool_start'; toolName: string }
  | {
      type: 'tool_result';
      toolName: string;
      data: unknown;
      deepLinks: CopilotDeepLink[];
      suggestions: string[];
    }
  | { type: 'done'; response: CopilotResponse }
  | { type: 'error'; error: string };

/** One provider in the copilot's fallback chain. */
export interface CopilotProviderInfo {
  name: string;
  model: string;
  /** Whether this provider has an API key configured. */
  configured: boolean;
}

/** What the copilot can do — lets the UI degrade gracefully when unconfigured. */
export interface CopilotCapabilities {
  /** True when at least one provider in the chain is configured. */
  configured: boolean;
  /** Ordered fallback chain (primary first). */
  providers: CopilotProviderInfo[];
  suggestedQuestions: string[];
}

/** Raw CSV row as parsed from an uploaded file. */
export interface CsvEmployeeRow {
  employeeCode?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  gender?: string;
  dateOfBirth?: string;
  hiredAt?: string;
  status?: string;
  department?: string;
  team?: string;
  managerEmail?: string;

  // ── Analytics & engagement profile (Phase 4) ─────────────────────────────
  attrition?: string;
  /** When attrition occurred (ISO date). */
  attritionDate?: string;
  monthlyIncome?: string;
  jobSatisfaction?: string;
  environmentSatisfaction?: string;
  relationshipSatisfaction?: string;
  workLifeBalance?: string;
  overTime?: string;
  performanceRating?: string;
  education?: string;
  educationField?: string;
  jobLevel?: string;
  yearsAtCompany?: string;
  yearsInCurrentRole?: string;
  yearsSinceLastPromotion?: string;
  yearsWithCurrManager?: string;
  totalWorkingYears?: string;
  distanceFromHome?: string;
  maritalStatus?: string;
  businessTravel?: string;
  numCompaniesWorked?: string;
  trainingTimesLastYear?: string;
  percentSalaryHike?: string;
  stockOptionLevel?: string;
}

// ── Period comparison ─────────────────────────────────────────────────────

export interface PeriodMetrics {
  headcount: number;
  attritionCount: number;
  attritionRate: string;
  averageTenure: string;
  averageIncome: number;
  overtimeRate: string;
  averageSatisfaction: string;
  newHires: number;
  activeCount: number;
}

export interface PeriodComparison {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  deltas: {
    headcount: number;
    attritionRate: string;
    averageTenure: string;
    overtimeRate: string;
    averageSatisfaction: string;
    newHires: number;
  };
  currentPeriod: { start: string; end: string };
  previousPeriod: { start: string; end: string };
}
