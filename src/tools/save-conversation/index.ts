import { homedir } from "os";
import * as path from "path";

import { tool } from "@opencode-ai/plugin";
import type { PluginInput } from "@opencode-ai/plugin";

import { logger } from "../../logger";
import { getCurrentDate, getNextCounter } from "./counter";
import { calculateDuration, writeSession } from "./session-writer";
import { generateSlug, slugToTitle } from "./slug-generator";
import type { SessionEntry } from "./types";

export function createSaveConversationTool(ctx: PluginInput) {
  return tool({
    description: `Save the current conversation to a session file and compact context.

In line with your context management strategy, use this tool:
- After completing a feature or major task
- When context is getting large
- At natural stopping points

The tool will:
1. Generate a semantic filename based on conversation content
2. Save full conversation with enhanced metadata
3. Trigger context compaction (summarization)
4. Return the session path for future reference
`,
    args: {
      note: tool.schema.string().optional().describe("Optional note about what was accomplished"),
    },

    async execute(args, context) {
      const startTime = new Date();
      const { sessionID } = context;

      try {
        const { data: messages } = await ctx.client.session.messages({
          path: { id: sessionID },
          query: { directory: ctx.directory },
        });

        if (!messages || messages.length === 0) {
          return "No messages to save.";
        }

        const { tokensInput, tokensOutput, tokensBefore } = calculateTokens(messages);

        const contextString = buildContextString(messages, args.note);
        const slug = await generateSlug(contextString);
        const title = slugToTitle(slug);
        const date = getCurrentDate();
        const counter = await getNextCounter(date);
        const endTime = new Date();
        const duration = calculateDuration(startTime, endTime);

        // TODO: currently transcripts from oh-my-opencode with anthropic agents
        // are located in ~/.claude/transcripts as jsonl files
        const transcriptPath = path.join(homedir(), ".claude", "transcripts", `${sessionID}.jsonl`);

        const summary = await generateSummary(messages, slug);

        const entry: SessionEntry = {
          sessionID,
          savedAt: endTime.toISOString(),
          date,
          counter,
          slug,
          title,
          summary,
          note: args.note,
          tokensBefore,
          tokensInput,
          tokensOutput,
          transcriptPath,
          messageCount: messages.length,
          duration,
        };

        const sessionPath = writeSession(entry);

        const lastAssistant = [...messages].reverse().find((m) => m.info.role === "assistant");
        const providerID =
          lastAssistant?.info.role === "assistant" ? lastAssistant.info.providerID : "anthropic";
        const modelID =
          lastAssistant?.info.role === "assistant" ? lastAssistant.info.modelID : "claude-sonnet-4";

        ctx.client.session
          .summarize({
            path: { id: sessionID },
            body: { providerID, modelID },
            query: { directory: ctx.directory },
          })
          .catch((err) => {
            logger.error("Summarize failed", err);
          });

        await ctx.client.tui.showToast({
          body: {
            title: "Session Saved",
            message: `${date}_${counter}_${slug}.md`,
            variant: "success",
            duration: 3000,
          },
        });

        return `✅ Conversation saved!

**Session**: \`${date}_${counter}_${slug}.md\`
**Title**: ${title}
**Path**: ${sessionPath}
**Messages**: ${messages.length}
**Tokens**: ${tokensBefore.toLocaleString()} (${tokensInput.toLocaleString()} in, ${tokensOutput.toLocaleString()} out)

Context compaction triggered. The conversation will be summarized.
To recall details later, check the session file or grep the transcript.`;
      } catch (error) {
        logger.error("Failed to save conversation", error);
        return `❌ Failed to save conversation: ${error}`;
      }
    },
  });
}

function calculateTokens(messages: any[]): {
  tokensInput: number;
  tokensOutput: number;
  tokensBefore: number;
} {
  let tokensInput = 0;
  let tokensOutput = 0;

  for (const message of messages) {
    if (message.role === "assistant" && message.tokens) {
      tokensInput += message.tokens.input ?? 0;
      tokensOutput += message.tokens.output ?? 0;
    }
  }

  return {
    tokensInput,
    tokensOutput,
    tokensBefore: tokensInput + tokensOutput,
  };
}

async function generateSummary(messages: any[], slug: string): Promise<string> {
  const messageCount = messages.length;
  const userMessages = messages.filter((m) => m.role === "user").length;
  const assistantMessages = messages.filter((m) => m.role === "assistant").length;

  return `Work session focused on: ${slugToTitle(
    slug,
  )}. Exchanged ${messageCount} messages (${userMessages} user, ${assistantMessages} assistant). See transcript for full details.`;
}

function buildContextString(messages: any[], note?: string): string {
  if (note) {
    return note;
  }

  const lastUserMessages = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.summary?.title || m.summary?.body || "")
    .filter(Boolean)
    .join(". ");

  return lastUserMessages || "Work session";
}
