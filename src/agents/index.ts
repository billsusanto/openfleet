import { actorAgent } from "./actor";
import { housekeepingAgent } from "./housekeeping";
import { orchestratorAgent } from "./orchestrator";
import { plannerAgent } from "./planner";
import { readonlyOrchestratorAgent } from "./read-only";
import { reflectorAgent } from "./reflector";
import { reviewerAgent } from "./reviewer";
import { scoutAgent } from "./scout";

export const agents = {
  "Zeus (Orchestrator)": orchestratorAgent,
  "Hera (Read-only Orchestrator)": readonlyOrchestratorAgent,
  "[Openfleet] Athena (Scout)": scoutAgent,
  "[Openfleet] Apollo (Planner)": plannerAgent,
  "[Openfleet] Hercules (Actor)": actorAgent,
  "[Openfleet] Chiron (Reviewer)": reviewerAgent,
  "[Openfleet] Mnemosyne (Reflector)": reflectorAgent,
  "[Openfleet] Hermes (Housekeeping)": housekeepingAgent,
};

export function configureAgents(config: { agent?: Record<string, unknown> }) {
  const nonOpenfleetAgents: Record<string, unknown> = {};
  for (const [name, agent] of Object.entries(config.agent ?? {})) {
    nonOpenfleetAgents[name] = {
      ...(agent as Record<string, unknown>),
      mode: "subagent",
    };
  }

  config.agent = {
    ...nonOpenfleetAgents,
    ...agents,
  };
}
