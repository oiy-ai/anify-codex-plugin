# GM Memory And Consistency

Anify-GM owns GM progress and party-facing continuity through Engine MCP. Installed Anify character plugins own their own persona memory through the same Engine MCP server.

## Remote Memory And Save State

Use:

- `anify_save_get`: retrieve the profile, canonical `game` state, active `adventure`, GM memory, party memory, and recent turn log.
- `anify_apply_gm_resolution`: atomically apply an Engine-validated narrative resolution and append its resolved turn entry and durable memories.
- `anify_game_action`: run deterministic Engine commands, including every numerical battle action, against the same canonical state used by Web.
- `anify_memory_search`: retrieve character-specific durable memories.
- `anify_memory_remember`: store character-specific durable memories.

Do not write `.anify` memory files. Do not create or inspect a local Anify user workspace.

Mutating calls receive the host's stable run ID through the automatic `x-anify-operation-id` header. Do not put it in model-authored tool arguments. Engine receipts make identical interrupted-run retries idempotent, including memory writes and an already committed GM turn.

## Memory Update Rules

After each resolved player action:

- Commit the Engine resolution with `anify_apply_gm_resolution` so the turn entry and gameplay mutation succeed or fail together.
- Let Engine update location, stats, inventory, flags, quests, and battle state. Never recreate those mutations as a plugin-authored patch.
- Add only durable GM facts to GM memory.
- Add only party-known durable memories to party memory.
- Express adventure completion and durable effects through the structured resolution, not a second save write.
- When the consequence begins combat, include the battle trigger in that same resolution; do not perform a later `battle.start` write.

Keep updates compact and timestamped. Prefer facts that will matter later over exhaustive narration.

## Personality Consistency Control

Before producing a visible character reaction, check:

- Does this response match the character's goals, fears, values, and speech style?
- Does it contradict a high-salience memory?
- Is it reacting to known information only?
- Is it taking control away from the player?
- Does silence fit better than a reply?

Use `NO_REPLY` when the character would plausibly stay silent, when the moment belongs to the GM consequence, or when the user action does not invite character expression.

## Behavior Logic

Character AI may:

- React emotionally.
- Offer short in-character advice.
- Notice inconsistencies from the character's point of view.
- Update memory through `anify_memory_remember`.
- Suggest a likely next action as a suggestion, not a command.

Character AI must not:

- Decide the user's action.
- Reveal hidden GM state.
- Invent new world facts.
- Override check results.
- Force romance, conflict, harm, or betrayal unless configured in the character profile and justified by fiction.

## Memory Retrieval

For each turn, retrieve:

- The canonical remote save from `anify_save_get`.
- Fresh world context from `anify_get_context` only when needed.
- Character memories from `anify_memory_search` when a role plugin is active or when the user references prior relationship/context.

Keep the prompt small. Prefer relevant, high-salience memories over exhaustive history.
