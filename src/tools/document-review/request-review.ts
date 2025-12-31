import * as fs from "fs";
import * as path from "path";

import { tool } from "@opencode-ai/plugin";

import { logger } from "../../logger";
import { getReviewServer, startReviewServer } from "../../review-server";
import { findReviewByPath, readDocument, saveReview } from "../../review-server/storage";
import type { RequestReviewResult, Review } from "../../review-server/types";
import { generateId } from "../../review-server/types";

export const requestReviewTool = tool({
  description: `Request human review of a markdown document.

Opens a browser UI where the reviewer can:
- Read the rendered markdown with line numbers
- Add inline comments on specific lines
- Submit "Approve" or "Request Changes"

Returns immediately with a URL and review ID. Use get_review_status to poll for completion.

Example:
  request_review({ documentPath: "~/.openfleet/tasks/feature/HLD.md" })
  // Returns: { reviewId: "rev_abc", url: "http://localhost:4242/review/rev_abc", status: "pending_review" }
`,
  args: {
    documentPath: tool.schema.string().describe("Absolute path to the markdown file to review"),
    message: tool.schema.string().optional().describe("Message explaining what to focus on"),
  },

  async execute(args) {
    const { documentPath, message } = args;

    if (!path.isAbsolute(documentPath)) {
      return JSON.stringify(
        {
          error: `Document path must be absolute. Received: ${documentPath}`,
        },
        null,
        2,
      );
    }

    if (!fs.existsSync(documentPath)) {
      return JSON.stringify(
        {
          error: `Document not found: ${documentPath}`,
        },
        null,
        2,
      );
    }

    try {
      await startReviewServer();
      const port = getReviewServer().getPort();

      const existingReview = findReviewByPath(documentPath);

      if (existingReview) {
        if (existingReview.status === "pending_review") {
          const result: RequestReviewResult = {
            reviewId: existingReview.id,
            url: `http://localhost:${port}/review/${existingReview.id}`,
            status: existingReview.status,
            message: "Existing review already pending. Please wait for reviewer feedback.",
          };
          return JSON.stringify(result, null, 2);
        }

        if (existingReview.status === "changes_requested") {
          const now = new Date().toISOString();
          existingReview.status = "pending_review";
          existingReview.currentRound += 1;
          existingReview.message = message;
          existingReview.updatedAt = now;
          saveReview(existingReview);

          logger.info("Review resubmitted", {
            reviewId: existingReview.id,
            newRound: existingReview.currentRound,
          });

          const result: RequestReviewResult = {
            reviewId: existingReview.id,
            url: `http://localhost:${port}/review/${existingReview.id}`,
            status: existingReview.status,
            message: `Review resubmitted for round ${existingReview.currentRound}. Reviewer notified.`,
          };
          return JSON.stringify(result, null, 2);
        }
      }

      const doc = readDocument(documentPath);
      if (!doc) {
        return JSON.stringify(
          {
            error: `Could not read document: ${documentPath}`,
          },
          null,
          2,
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

      const result: RequestReviewResult = {
        reviewId: review.id,
        url: `http://localhost:${port}/review/${review.id}`,
        status: review.status,
        message: "Review opened. Use get_review_status to check progress.",
      };
      return JSON.stringify(result, null, 2);
    } catch (error) {
      logger.error("Failed to request review", error);
      return JSON.stringify(
        {
          error: `Failed to request review: ${error instanceof Error ? error.message : String(error)}`,
        },
        null,
        2,
      );
    }
  },
});
