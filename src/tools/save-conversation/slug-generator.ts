import { getAnthropicClient } from "../../lib/anthropic";
import { logger } from "../../logger";
import type { SlugContext } from "./types";

const FALLBACK_SLUG = "work-session";
const MAX_SLUG_LENGTH = 50;
const MIN_SLUG_LENGTH = 5;

/**
 * Generates a semantic slug using simple context string.
 *
 * This function takes a context string (usually from user's note or session summary)
 * and generates a kebab-case slug using Claude Haiku.
 *
 * Example:
 *   >>> const slug = await generateSlug("Implemented user authentication system");
 *   >>> slug
 *   'implement-user-auth'
 */
export async function generateSlug(contextString: string, context?: SlugContext): Promise<string> {
  try {
    if (!contextString || contextString.trim().length === 0) {
      logger.warn("No context to generate slug from, using fallback");
      return FALLBACK_SLUG;
    }

    const rawSlug = await callAnthropicForSlug(contextString);

    const sanitized = sanitizeSlug(rawSlug);

    if (!isValidSlug(sanitized)) {
      logger.warn("Generated slug invalid after sanitization", {
        raw: rawSlug,
        sanitized,
      });
      return FALLBACK_SLUG;
    }

    return sanitized;
  } catch (error) {
    logger.error("Slug generation failed", error);
    return FALLBACK_SLUG;
  }
}

async function callAnthropicForSlug(context: string): Promise<string> {
  const anthropic = getAnthropicClient();

  const systemPrompt = `You are a concise session summarizer.
  
Your job is to read a conversation description and output ONLY a short kebab-case slug
(2-4 words) that captures the main topic.

Rules:
- Output ONLY the slug, nothing else
- Use lowercase letters and hyphens only
- 2-4 words maximum
- No quotes, no punctuation, no explanations
- Be specific and descriptive

Examples:
- implement-user-auth
- fix-login-redirect
- refactor-api-client
- add-postgres-migration
- debug-websocket-error`;

  const userPrompt = `Summarize this work session in 2-4 words (kebab-case format only):

${context}

Output only the slug:`;

  const message = await anthropic.messages.create({
    model: "claude-3-haiku-20240307",
    max_tokens: 20,
    temperature: 0.3,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text response from API");
  }

  return textBlock.text.trim();
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

function isValidSlug(slug: string): boolean {
  if (!slug || slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return false;
  }

  const pattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return pattern.test(slug);
}

export function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
