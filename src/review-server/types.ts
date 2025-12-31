export type ReviewStatus = "pending_review" | "changes_requested" | "approved";

export type Author = "human" | "agent";

export type ReviewDecision = "approve" | "request_changes";

export interface Review {
  id: string;
  documentPath: string;
  documentHash: string;
  status: ReviewStatus;
  currentRound: number;
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentThread {
  id: string;
  reviewId: string;
  round: number;
  lineStart: number;
  lineEnd: number;
  body: string;
  author: Author;
  resolved: boolean;
  resolvedBy?: Author;
  createdAt: string;
  resolvedAt?: string;
  replies: CommentReply[];
}

export interface CommentReply {
  id: string;
  threadId: string;
  body: string;
  author: Author;
  createdAt: string;
}

export interface ReviewSubmission {
  reviewId: string;
  round: number;
  decision: ReviewDecision;
  submittedAt: string;
}

export interface DocumentContent {
  path: string;
  content: string;
  lines: string[];
  hash: string;
  lastModified: string;
}

export interface RequestReviewResult {
  reviewId: string;
  url: string;
  status: ReviewStatus;
  message: string;
}

export interface ReviewStatusResult {
  reviewId: string;
  status: ReviewStatus;
  currentRound: number;
  decision?: ReviewDecision;
  threads: ThreadSummary[];
  pendingCount: number;
  resolvedCount: number;
}

export interface ThreadSummary {
  id: string;
  lineStart: number;
  lineEnd: number;
  body: string;
  author: Author;
  resolved: boolean;
  replyCount: number;
}

export interface ThreadsFile {
  reviewId: string;
  threads: CommentThread[];
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export function generateId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const id = Array.from(bytes)
    .map((b) => b.toString(36))
    .join("")
    .slice(0, 10);
  return `${prefix}_${id}`;
}
