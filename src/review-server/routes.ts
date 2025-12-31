import * as fs from "fs";
import * as path from "path";

import type { Context, Hono } from "hono";

import { logger } from "../logger";
import {
  findReviewByPath,
  getReview,
  getThreads,
  readDocument,
  saveReview,
  saveThreads,
} from "./storage";
import type { ApiError, CommentReply, CommentThread, Review, ReviewDecision } from "./types";
import { generateId } from "./types";
import { render404Page, renderReviewPage } from "./ui";

interface CreateReviewBody {
  documentPath: string;
  message?: string;
}

export function setupRoutes(app: Hono, getUptime: () => number, getPort: () => number): void {
  app.get("/api/health", (c: Context) => {
    return c.json({
      status: "ok",
      port: getPort(),
      uptime: Math.floor(getUptime() / 1000),
    });
  });

  app.post("/api/reviews", async (c: Context) => {
    let body: CreateReviewBody;
    try {
      body = await c.req.json<CreateReviewBody>();
    } catch {
      return c.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
          },
        } satisfies ApiError,
        400,
      );
    }

    const { documentPath, message } = body;

    if (!documentPath) {
      return c.json(
        {
          error: {
            code: "INVALID_PATH",
            message: "documentPath is required",
          },
        } satisfies ApiError,
        400,
      );
    }

    if (!path.isAbsolute(documentPath)) {
      return c.json(
        {
          error: {
            code: "INVALID_PATH",
            message: "documentPath must be an absolute path",
          },
        } satisfies ApiError,
        400,
      );
    }

    if (!fs.existsSync(documentPath)) {
      return c.json(
        {
          error: {
            code: "FILE_NOT_FOUND",
            message: `Document not found: ${documentPath}`,
          },
        } satisfies ApiError,
        400,
      );
    }

    const existingReview = findReviewByPath(documentPath);
    if (existingReview) {
      if (existingReview.status === "pending_review") {
        return c.json({
          id: existingReview.id,
          documentPath: existingReview.documentPath,
          status: existingReview.status,
          currentRound: existingReview.currentRound,
          url: `http://localhost:${getPort()}/review/${existingReview.id}`,
          message: "Existing review already pending",
        });
      }
    }

    const doc = readDocument(documentPath);
    if (!doc) {
      return c.json(
        {
          error: {
            code: "FILE_NOT_FOUND",
            message: `Could not read document: ${documentPath}`,
          },
        } satisfies ApiError,
        400,
      );
    }

    const now = new Date().toISOString();
    const review: Review = {
      id: generateId("rev"),
      documentPath,
      documentHash: doc.hash,
      status: "pending_review",
      currentRound: 1,
      message,
      createdAt: now,
      updatedAt: now,
    };

    saveReview(review);
    logger.info("Review created", { reviewId: review.id, documentPath });

    return c.json(
      {
        id: review.id,
        documentPath: review.documentPath,
        status: review.status,
        currentRound: review.currentRound,
        url: `http://localhost:${getPort()}/review/${review.id}`,
        createdAt: review.createdAt,
      },
      201,
    );
  });

  app.get("/api/reviews/:id", (c: Context) => {
    const reviewId = c.req.param("id");
    const review = getReview(reviewId);

    if (!review) {
      return c.json(
        {
          error: {
            code: "REVIEW_NOT_FOUND",
            message: `Review with ID '${reviewId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    return c.json(review);
  });

  app.get("/api/reviews/:id/document", (c: Context) => {
    const reviewId = c.req.param("id");
    const review = getReview(reviewId);

    if (!review) {
      return c.json(
        {
          error: {
            code: "REVIEW_NOT_FOUND",
            message: `Review with ID '${reviewId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    const doc = readDocument(review.documentPath);
    if (!doc) {
      return c.json(
        {
          error: {
            code: "DOCUMENT_NOT_FOUND",
            message: `Document file not found: ${review.documentPath}`,
          },
        } satisfies ApiError,
        404,
      );
    }

    return c.json(doc);
  });

  app.get("/api/reviews/:id/threads", (c: Context) => {
    const reviewId = c.req.param("id");
    const review = getReview(reviewId);

    if (!review) {
      return c.json(
        {
          error: {
            code: "REVIEW_NOT_FOUND",
            message: `Review with ID '${reviewId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    const threads = getThreads(reviewId);
    return c.json({ reviewId, threads });
  });

  app.post("/api/reviews/:id/threads", async (c: Context) => {
    const reviewId = c.req.param("id");
    const review = getReview(reviewId);

    if (!review) {
      return c.json(
        {
          error: {
            code: "REVIEW_NOT_FOUND",
            message: `Review with ID '${reviewId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    let body: { lineStart?: number; lineEnd?: number; body?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
          },
        } satisfies ApiError,
        400,
      );
    }

    const { lineStart, lineEnd, body: commentBody } = body;

    if (!commentBody || commentBody.trim() === "") {
      return c.json(
        {
          error: {
            code: "BODY_REQUIRED",
            message: "Comment body is required",
          },
        } satisfies ApiError,
        400,
      );
    }

    if (
      typeof lineStart !== "number" ||
      typeof lineEnd !== "number" ||
      lineStart < 1 ||
      lineEnd < 1 ||
      lineStart > lineEnd
    ) {
      return c.json(
        {
          error: {
            code: "INVALID_LINES",
            message: "lineStart and lineEnd must be positive numbers with lineStart <= lineEnd",
          },
        } satisfies ApiError,
        400,
      );
    }

    const now = new Date().toISOString();
    const thread: CommentThread = {
      id: generateId("cmt"),
      reviewId,
      round: review.currentRound,
      lineStart,
      lineEnd,
      body: commentBody,
      author: "human",
      resolved: false,
      createdAt: now,
      replies: [],
    };

    const threads = getThreads(reviewId);
    threads.push(thread);
    saveThreads(reviewId, threads);

    logger.info("Thread created", { reviewId, threadId: thread.id, lineStart, lineEnd });

    return c.json(thread, 201);
  });

  app.patch("/api/reviews/:id/threads/:threadId", async (c: Context) => {
    const reviewId = c.req.param("id");
    const threadId = c.req.param("threadId");

    const review = getReview(reviewId);
    if (!review) {
      return c.json(
        {
          error: {
            code: "REVIEW_NOT_FOUND",
            message: `Review with ID '${reviewId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    const threads = getThreads(reviewId);
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) {
      return c.json(
        {
          error: {
            code: "THREAD_NOT_FOUND",
            message: `Thread with ID '${threadId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    let body: { resolved?: boolean };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
          },
        } satisfies ApiError,
        400,
      );
    }

    const { resolved } = body;

    if (typeof resolved === "boolean") {
      thread.resolved = resolved;
      if (resolved) {
        thread.resolvedBy = "human";
        thread.resolvedAt = new Date().toISOString();
      } else {
        thread.resolvedBy = undefined;
        thread.resolvedAt = undefined;
      }
    }

    saveThreads(reviewId, threads);
    logger.info("Thread updated", { reviewId, threadId, resolved: thread.resolved });

    return c.json({
      id: thread.id,
      resolved: thread.resolved,
      resolvedBy: thread.resolvedBy,
      resolvedAt: thread.resolvedAt,
    });
  });

  app.post("/api/reviews/:id/threads/:threadId/replies", async (c: Context) => {
    const reviewId = c.req.param("id");
    const threadId = c.req.param("threadId");

    const review = getReview(reviewId);
    if (!review) {
      return c.json(
        {
          error: {
            code: "REVIEW_NOT_FOUND",
            message: `Review with ID '${reviewId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    const threads = getThreads(reviewId);
    const thread = threads.find((t) => t.id === threadId);
    if (!thread) {
      return c.json(
        {
          error: {
            code: "THREAD_NOT_FOUND",
            message: `Thread with ID '${threadId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    let body: { body?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
          },
        } satisfies ApiError,
        400,
      );
    }

    const { body: replyBody } = body;

    if (!replyBody || replyBody.trim() === "") {
      return c.json(
        {
          error: {
            code: "BODY_REQUIRED",
            message: "Reply body is required",
          },
        } satisfies ApiError,
        400,
      );
    }

    const reply: CommentReply = {
      id: generateId("rep"),
      threadId,
      body: replyBody,
      author: "human",
      createdAt: new Date().toISOString(),
    };

    thread.replies.push(reply);
    saveThreads(reviewId, threads);

    logger.info("Reply added", { reviewId, threadId, replyId: reply.id });

    return c.json(reply, 201);
  });

  app.post("/api/reviews/:id/submit", async (c: Context) => {
    const reviewId = c.req.param("id");
    const review = getReview(reviewId);

    if (!review) {
      return c.json(
        {
          error: {
            code: "REVIEW_NOT_FOUND",
            message: `Review with ID '${reviewId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    if (review.status !== "pending_review") {
      return c.json(
        {
          error: {
            code: "INVALID_STATE",
            message: `Review must be in 'pending_review' state to submit, current state: '${review.status}'`,
          },
        } satisfies ApiError,
        400,
      );
    }

    let body: { decision?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Invalid JSON in request body",
          },
        } satisfies ApiError,
        400,
      );
    }

    const { decision } = body;

    if (decision !== "approve" && decision !== "request_changes") {
      return c.json(
        {
          error: {
            code: "INVALID_DECISION",
            message: "Decision must be 'approve' or 'request_changes'",
          },
        } satisfies ApiError,
        400,
      );
    }

    const typedDecision = decision as ReviewDecision;
    const now = new Date().toISOString();

    review.status = typedDecision === "approve" ? "approved" : "changes_requested";
    review.updatedAt = now;
    saveReview(review);

    logger.info("Review submitted", {
      reviewId,
      decision: typedDecision,
      newStatus: review.status,
    });

    return c.json({
      id: review.id,
      status: review.status,
      currentRound: review.currentRound,
      decision: typedDecision,
      submittedAt: now,
    });
  });

  app.post("/api/reviews/:id/resubmit", async (c: Context) => {
    const reviewId = c.req.param("id");
    const review = getReview(reviewId);

    if (!review) {
      return c.json(
        {
          error: {
            code: "REVIEW_NOT_FOUND",
            message: `Review with ID '${reviewId}' not found`,
          },
        } satisfies ApiError,
        404,
      );
    }

    if (review.status !== "changes_requested") {
      return c.json(
        {
          error: {
            code: "INVALID_STATE",
            message: `Review must be in 'changes_requested' state to resubmit, current state: '${review.status}'`,
          },
        } satisfies ApiError,
        400,
      );
    }

    let body: { message?: string };
    try {
      body = await c.req.json();
    } catch {
      body = {};
    }

    const now = new Date().toISOString();
    review.status = "pending_review";
    review.currentRound += 1;
    review.message = body.message;
    review.updatedAt = now;
    saveReview(review);

    logger.info("Review resubmitted", { reviewId, newRound: review.currentRound });

    return c.json({
      id: review.id,
      status: review.status,
      currentRound: review.currentRound,
      url: `http://localhost:${getPort()}/review/${review.id}`,
    });
  });

  app.get("/review/:id", (c: Context) => {
    const reviewId = c.req.param("id");
    const review = getReview(reviewId);

    if (!review) {
      return c.html(render404Page(reviewId), 404);
    }

    return c.html(renderReviewPage(reviewId));
  });
}
