import { tool } from "@opencode-ai/plugin";

import { logger } from "../../logger";
import { getReview, getThreads } from "../../review-server/storage";
import type { ReviewStatusResult, ThreadSummary } from "../../review-server/types";

export const getReviewStatusTool = tool({
  description: `Check the status of a document review.

Use this to poll for review completion after calling request_review.
Returns the current status and any comments/threads.

Example:
  get_review_status({ reviewId: "rev_abc123" })
  // Returns status, threads with comments, pending/resolved counts
`,
  args: {
    reviewId: tool.schema.string().describe("The review ID returned from request_review"),
  },

  async execute(args) {
    const { reviewId } = args;

    try {
      const review = getReview(reviewId);
      if (!review) {
        return JSON.stringify(
          {
            error: `Review not found: ${reviewId}`,
          },
          null,
          2,
        );
      }

      const threads = getThreads(reviewId);

      const threadSummaries: ThreadSummary[] = threads.map((t) => ({
        id: t.id,
        lineStart: t.lineStart,
        lineEnd: t.lineEnd,
        body: t.body,
        author: t.author,
        resolved: t.resolved,
        replyCount: t.replies.length,
      }));

      const pendingCount = threads.filter((t) => !t.resolved).length;
      const resolvedCount = threads.filter((t) => t.resolved).length;

      const result: ReviewStatusResult = {
        reviewId,
        status: review.status,
        currentRound: review.currentRound,
        threads: threadSummaries,
        pendingCount,
        resolvedCount,
      };

      return JSON.stringify(result, null, 2);
    } catch (error) {
      logger.error("Failed to get review status", error);
      return JSON.stringify(
        {
          error: `Failed to get review status: ${error instanceof Error ? error.message : String(error)}`,
        },
        null,
        2,
      );
    }
  },
});
