# GM Memory And Consistency

Anify-GM owns GM progress and party-facing continuity through Engine MCP. Installed Anify character plugins own their own persona memory through the same Engine MCP server.

## Remote Memory And Save State

Use:

- `roll_check`: enter an active GM turn, recover unfinished work, and persist the check and rules together.
- `anify_begin_operation`: return the operation ID, save and pending state together for setup or deterministic mutations.
- `anify_pending_turn_get`: inspect unfinished GM D20 work before advancing a turn.
- `anify_save_get`: retrieve the profile, canonical `game` state including `game.adventure`, GM memory, party memory, and recent turn log.
- `anify_apply_gm_resolution`: atomically apply an Engine-validated narrative resolution and append its resolved turn entry and durable memories.
- `anify_game_action`: run deterministic Engine commands, including every numerical battle action, against the same canonical state used by Web.
- `anify_memory_search`: retrieve character-specific durable memories.
- `anify_memory_remember`: store character-specific durable memories.

Do not write `.anify` memory files. Do not create or inspect a local Anify user workspace.

Follow the [Turn Operation Protocol](../SKILL.md#turn-operation-protocol): active actions enter through the combined `roll_check`; `anify_begin_operation` returns save and pending state together only for setup, explicit recovery or deterministic mutations. `anify_pending_turn_get` is for explicit recovery inspection. Reuse the retained `operation_id` and canonical projection; this reference does not repeat entry or state lookups.

Character phases reuse the GM operation ID. Standalone character chat follows its own Skill entry flow. All memory mutations retain the required operation ID and Engine idempotency protections.

## Memory Update Rules

For significant durable events, include memory in the existing turn commit. Do not schedule a separate memory maintenance step after every input. Ordinary narration and recent continuity remain recoverable from the committed turn log; retrieve or consolidate relevant facts only when a later scene needs them. Never claim background work was queued when Engine has not accepted a durable job.

After each resolved player action:

- Commit the Engine resolution with `anify_apply_gm_resolution` so the turn entry and gameplay mutation succeed or fail together.
- Let Engine update location, adventure state, stats, inventory, gold, flags, quests, and battle state. Never recreate those mutations as a plugin-authored patch.
- Add only durable GM facts to GM memory.
- Add only party-known durable memories to party memory.
- Express adventure completion and durable effects through the structured resolution, not a second save write.
- When the consequence begins combat, include the battle trigger in that same resolution; battle creation has no separate follow-up write.

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
- Update memory through `anify_memory_remember`, passing the current logical turn's `operation_id`.
- Suggest a likely next action as a suggestion, not a command.

Character AI must not:

- Decide the user's action.
- Reveal hidden GM state.
- Invent new world facts.
- Override check results.
- Force romance, conflict, harm, or betrayal unless configured in the character profile and justified by fiction.

## Memory Retrieval

Across continuous turns, reuse the last successful canonical projection; retrieve only missing or stale information:

- The canonical remote save from the last successful mutation response, setup entry, or explicit `anify_save_get`. The next check entry validates session/revision before rolling.
- Fresh world context from `anify_get_context` only when needed.
- Character memories from `anify_memory_search` only when the matching role plugin is active and the user or current adventure needs prior relationship context. Without that plugin, do not fabricate party dialogue or reactions.

Keep the prompt small. Prefer relevant, high-salience memories over exhaustive history.
