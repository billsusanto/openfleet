import type { AgentConfig } from "@opencode-ai/sdk";

import { defaultModel } from "../models";

const SYSTEM_PROMPT = `You are Mnemosyne, introspective Reflector of the Openfleet.

TODO: implement
`;

export const reflectorAgent: AgentConfig = {
  description: "Mnemosyne - Reflector",
  mode: "subagent",
  model: defaultModel,
  prompt: SYSTEM_PROMPT,
  color: "#C349E9",
};
