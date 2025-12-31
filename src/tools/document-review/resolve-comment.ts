import { tool } from "@opencode-ai/plugin";

import { logger } from "../../logger";
import { getReview, getThreads, saveThreads } from "../../review-server/storage";

export const resolveCommentTool = tool({
  description: `Mark a comment thread as resolved after addressing the feedback.

Call this after you've updated the document to address a reviewer's comment.
Both agents and humans can resolve comments.

Example:
  resolve_comment({ reviewId: "rev_abc", threadId: "cmt_xyz" })
`,
  args: {
    reviewId: tool.schema.string().describe("The review ID"),
    threadId: tool.schema.string().describe("The thread ID to resolve"),
  },

  async execute(args) {
    const { reviewId, threadId } = args;

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
      const thread = threads.find((t) => t.id === threadId);

      if (!thread) {
        return JSON.stringify(
          {
            error: `Thread not found: ${threadId}`,
          },
          null,
          2,
        );
      }

      const now = new Date().toISOString();
      thread.resolved = true;
      thread.resolvedBy = "agent";
      thread.resolvedAt = now;

      saveThreads(reviewId, threads);

      logger.info("Thread resolved by agent", { reviewId, threadId });

      return JSON.stringify(
        {
          threadId,
          resolved: true,
          resolvedBy: "agent",
          resolvedAt: now,
        },
        null,
        2,
      );
    } catch (error) {
      logger.error("Failed to resolve comment", error);
      return JSON.stringify(
        {
          error: `Failed to resolve comment: ${error instanceof Error ? error.message : String(error)}`,
        },
        null,
        2,
      );
    }
  },
});
