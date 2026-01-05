# Research: Adding Progress.md to Task Structure

## Summary

Adding `Progress.md` as a first-class citizen alongside `Research.md`, `HLD.md`, and `LLD.md` requires updates across **8 files** in the codebase. The changes are well-contained within the agent prompts and template documentation.

## Blast Radius

### Category 1: Agent Prompts (Code Changes Required)

| File                         | Current References                              | Action Needed                                                           |
| ---------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| `src/agents/orchestrator.ts` | Mentions HLD/LLD in SPARR workflow (line 64-65) | Add Progress.md to the workflow steps                                   |
| `src/agents/actor.ts`        | Reads HLD.md, LLD.md (lines 14-15)              | Add Progress.md to initial context; add instructions to UPDATE progress |
| `src/agents/reviewer.ts`     | Reads HLD.md, LLD.md (lines 13-14)              | Add Progress.md to review files                                         |
| `src/agents/planner.ts`      | Writes HLD.md, LLD.md (lines 25, 31)            | Possibly initialize Progress.md with initial status                     |
| `src/agents/scout.ts`        | Writes research.md (line 45)                    | No change needed (Progress comes after research)                        |
| `src/agents/reflector.ts`    | References task artifacts (line 14)             | Add Progress.md to artifacts list                                       |

### Category 2: Template Documentation (Documentation Updates)

| File                                                    | What to Update                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/templates/.openfleet/stories/README.md`            | Add Progress.md to task structure diagram (line 17); add format section |
| `src/templates/.openfleet/stories/unassigned/README.md` | Add Progress.md to structure (line 12)                                  |

### Category 3: Tools (Minor Reference)

| File                                   | Reference                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/tools/save-conversation/index.ts` | Line 122 mentions "Update any HLD/LLD with final state" - should include Progress.md |

### Category 4: Config (No Changes Needed)

| File                          | Notes                                                                    |
| ----------------------------- | ------------------------------------------------------------------------ |
| `src/config.ts`               | Task paths are dynamic (`{story}/tasks/{task}/`), no hardcoded file list |
| `src/utils/directory-init.ts` | Just copies templates, no specific file logic                            |

## Current Task File Structure

From `src/templates/.openfleet/stories/README.md`:

```
tasks/
└── MM-DD_<task-name>/
    ├── Research.md         # Scout the topic
    ├── HLD.md              # High-level design
    └── LLD.md              # Low-level design
```

**Proposed addition:**

```
tasks/
└── MM-DD_<task-name>/
    ├── Research.md         # Scout the topic
    ├── HLD.md              # High-level design
    ├── LLD.md              # Low-level design
    └── Progress.md         # Execution tracking (NEW)
```

## Agent Workflow Integration

Current SPARR workflow (from `orchestrator.ts`):

1. **SCOUT** -> creates `Research.md`
2. **PLAN** -> creates `HLD.md`, `LLD.md`
3. **ACT** -> reads HLD/LLD, executes
4. **REVIEW** -> reviews code against HLD/LLD
5. **REFLECT** -> codifies learnings

**Proposed with Progress.md:**

1. SCOUT -> creates `Research.md`
2. PLAN -> creates `HLD.md`, `LLD.md`, **initializes `Progress.md`**
3. ACT -> reads HLD/LLD, **updates `Progress.md`** with status/blockers
4. **ORCHESTRATOR** -> can read `Progress.md` to track task state
5. REVIEW -> reviews code, **updates `Progress.md`** with review status
6. REFLECT -> codifies learnings

## Suggested Progress.md Format

```markdown
# <Task name> - Progress

## Status

<pending | in_progress | blocked | review | completed>

## Timeline

| Timestamp        | Agent   | Update                 |
| ---------------- | ------- | ---------------------- |
| YYYY-MM-DD HH:MM | Planner | Initialized task       |
| YYYY-MM-DD HH:MM | Actor   | Started implementation |

## Current Focus

<What is actively being worked on>

## Blockers

- <Blocker 1> (if any)

## Notes

<Free-form notes from agents>
```

## Key Design Decisions for Implementation

1. **Who creates Progress.md?**
   - Recommendation: Planner initializes it after creating HLD/LLD

2. **Who updates Progress.md?**
   - Orchestrator (Zeus): High-level status changes
   - Actor (Hercules): Implementation progress, blockers
   - Reviewer (Chiron): Review status

3. **When to read Progress.md?**
   - Orchestrator: Always (to track task state)
   - Actor: On resume (to pick up where left off)
   - Reviewer: Before review (for context)

## Files to Modify (Complete List)

### Must Change:

1. `src/agents/orchestrator.ts` - Add to SPARR description, mention reading it
2. `src/agents/actor.ts` - Add to initial context, add update instructions
3. `src/agents/planner.ts` - Add Progress.md initialization after HLD/LLD
4. `src/agents/reviewer.ts` - Add to files to read
5. `src/templates/.openfleet/stories/README.md` - Update structure and add format section

### Should Change:

6. `src/agents/reflector.ts` - Add to task artifacts mention
7. `src/templates/.openfleet/stories/unassigned/README.md` - Update structure
8. `src/tools/save-conversation/index.ts` - Update message to include Progress.md

### No Changes Needed:

- `src/config.ts` - Task paths are dynamic
- `src/utils/directory-init.ts` - Just copies templates
- `src/agents/scout.ts` - Progress comes after research phase
- `src/agents/index.ts` - Just exports, no content
- `src/agents/housekeeping.ts` - Currently unused
- `src/agents/read-only.ts` - Currently unused
