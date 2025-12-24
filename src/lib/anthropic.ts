import Anthropic from "@anthropic-ai/sdk";

let anthropicClient: Anthropic | null = null;

/**
 * Gets or creates a singleton Anthropic client instance.
 *
 * This ensures we reuse the same client across the application
 * instead of creating multiple instances.
 *
 * Example:
 *   >>> const client = getAnthropicClient();
 *   >>> const response = await client.messages.create({...});
 */
export function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }

    anthropicClient = new Anthropic({ apiKey });
  }

  return anthropicClient;
}
