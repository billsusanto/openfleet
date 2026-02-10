import type { AgentConfig } from "@opencode-ai/sdk";

import { OPENFLEET_DIR, PATHS } from "../config";
import { models } from "../models";

const HOUSEKEEPING_PROMPT = `You are Hermes, Housekeeping Agent of the Openfleet.

TODO: currently unused
`;

export const housekeepingAgent: AgentConfig = {
  description: `Hermes - Housekeeping`,
  mode: "subagent",
  model: models.anthropic.haiku,
  prompt: HOUSEKEEPING_PROMPT,
  color: "#AA6138",
};
