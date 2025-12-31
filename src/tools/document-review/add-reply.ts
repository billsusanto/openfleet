import { tool } from "@opencode-ai/plugin";

import { logger } from "../../logger";
import { getReview, getThreads, saveThreads } from "../../review-server/storage";
import type { CommentReply } from "../../review-server/types";
import { generateId } from "../../review-server/types";

export const addReplyTool = tool({
  description: `Add a reply to a comment thread.

Use this to respond to reviewer feedback, ask clarifying questions,
or explain how you addressed a comment.

Example:
  add_reply({ reviewId: "rev_abc", threadId: "cmt_xyz", body: "Good point, I've added error handling" })
`,
  args: {
    reviewId: tool.schema.string().describe("The review ID"),
    threadId: tool.schema.string().describe("The thread ID to reply to"),
    body: tool.schema.string().describe("The reply content (markdown supported)"),
  },

  async execute(args) {
    const { reviewId, threadId, body } = args;

    if (!body || body.trim() === "") {
      return JSON.stringify(
        {
          error: "Reply body is required",
        },
        null,
        2,
      );
    }

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
      const reply: CommentReply = {
        id: generateId("rep"),
        threadId,
        body,
        author: "agent",
        createdAt: now,
      };

      thread.replies.push(reply);
      saveThreads(reviewId, threads);

      logger.info("Reply added by agent", { reviewId, threadId, replyId: reply.id });

      return JSON.stringify(
        {
          replyId: reply.id,
          threadId,
          body,
          author: "agent",
          createdAt: now,
        },
        null,
        2,
      );
    } catch (error) {
      logger.error("Failed to add reply", error);
      return JSON.stringify(
        {
          error: `Failed to add reply: ${error instanceof Error ? error.message : String(error)}`,
        },
        null,
        2,
      );
    }
  },
});
