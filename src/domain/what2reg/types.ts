import type { GapReason, SelectionBasis } from "../recommend";

/** Official read-only MCP resource. Documented at https://umeh.top/mcp. */
export const WHAT2REG_MCP_URL = "https://umeh.top/mcp";

/** Clerk authorization server advertised by the protected-resource metadata. */
export const WHAT2REG_ISSUER = "https://clerk.umeh.top";

export const WHAT2REG_AUTHORIZATION_ENDPOINT = "https://clerk.umeh.top/oauth/authorize";
export const WHAT2REG_TOKEN_ENDPOINT = "https://clerk.umeh.top/oauth/token";
export const WHAT2REG_REVOCATION_ENDPOINT = "https://clerk.umeh.top/oauth/token/revoke";

/** Required scope from the What2Reg terms (2026-10-24). offline_access enables the documented refresh grant. */
export const WHAT2REG_SCOPE = "umhelper:read offline_access";
export const WHAT2REG_REQUIRED_SCOPE = "umhelper:read";

export const WHAT2REG_PROTOCOL_VERSION = "2025-03-26";

/** Public pages returned by the MCP use this origin. www.umeh.top is accepted as the same site. */
export const WHAT2REG_ALLOWED_HOSTS = ["umeh.top", "www.umeh.top"] as const;

export const REVIEW_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Courses a single recommendation pass may look up. */
export const PLAN_REVIEW_COURSE_CAP = 4;

/** Review-text lookups while one course card is open. */
export const CARD_REVIEW_INSTRUCTOR_CAP = 3;

/** Instructor rows taken from one get_course page. The tool itself caps a page at 20. */
export const CARD_INSTRUCTOR_CAP = 4;

/** Top-level public summaries requested per instructor. The tool caps a page at 10. */
export const REVIEW_PAGE_LIMIT = 5;

/** Assistant readReviews calls allowed in one turn, inside the existing tool budget. */
export const READ_REVIEWS_TURN_LIMIT = 4;

export const WHAT2REG_ATTRIBUTION = "澳大選咩課 / What2Reg @ UM";

export const WHAT2REG_DISCLAIMER =
  "Community opinions from 澳大選咩課 / What2Reg @ UM. They are not official University of Macau statements.";

export type ReviewSummary = {
  text: string;
  url: string | null;
  publishedAt: string | null;
};

export type InstructorReviews = {
  name: string;
  grade: number | null;
  difficulty: number | null;
  usefulness: number | null;
  url: string | null;
  summaries: ReviewSummary[];
};

export type ReviewLookupStatus = "ok" | "empty" | "unauthorized" | "unavailable";

export const REVIEW_THEMES = ["workload", "teaching", "assessment", "worth", "grading", "other"] as const;
export type ReviewTheme = (typeof REVIEW_THEMES)[number];

export const REVIEW_UNCERTAINTY = ["none", "small-sample", "conflict"] as const;
export type ReviewUncertainty = (typeof REVIEW_UNCERTAINTY)[number];

/** One pro or con. `groundedIn` is a span copied from a public review summary. */
export type ReviewPoint = {
  text: string;
  theme: ReviewTheme;
  groundedIn: string;
};

export type ReviewImpression = {
  grade: string | null;
  difficulty: string | null;
  usefulness: string | null;
};

/**
 * Fixed-schema reading of one course's public reviews.
 * Soft preference only. It never changes legality.
 */
export type ReviewUnderstanding = {
  courseCode: string;
  impression: ReviewImpression;
  themes: ReviewTheme[];
  pros: ReviewPoint[];
  cons: ReviewPoint[];
  uncertainty: ReviewUncertainty;
  uncertaintyNote: string | null;
  sampleSize: number;
};

export type ReviewLookup = {
  status: ReviewLookupStatus;
  courseCode: string;
  attribution: string;
  disclaimer: string;
  instructors: InstructorReviews[];
  understanding: ReviewUnderstanding | null;
  /** Always false. Reviews never authorize dropping a legal course. */
  mayRejectLegalCourse: false;
};

export type CommunityReviewNote = {
  courseCode: string;
  instructor: string | null;
  grade: number | null;
  difficulty: number | null;
  usefulness: number | null;
  summary: string | null;
  url: string;
  understanding: ReviewUnderstanding | null;
};

export type RankedAdditions = {
  keys: string[];
  selections: {
    sectionKey: string;
    courseCode: string;
    basis: SelectionBasis;
    detail: string;
  }[];
  gapReason: GapReason;
};

export type What2RegGrant = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string;
};

export type What2RegTokenStore = {
  get(userId: string): Promise<What2RegGrant | null>;
  save(userId: string, grant: What2RegGrant): Promise<void>;
  delete(userId: string): Promise<void>;
};
