# Anify Orchestration

This protocol keeps Engine rules, GM narration, and Character AI independently evolvable.

## Authority Boundaries

Engine MCP owns:

- Firebase-gated tool access.
- Canonical gameplay state shared by Codex and Web through `anify_save_get`, `anify_apply_gm_resolution`, and `anify_game_action`.
- Character long-term memory through `anify_memory_search` and `anify_memory_remember`.
- World context loaded from Engine KV.
- D20 check results.
- Deterministic rule advice, revision validation, and all state mutations.
- Per-user SQLite operation receipts keyed by the effective operation ID and tool stage: the trusted Shell run header when present, otherwise the Engine-issued native turn ID.

GM AI owns:

- Scene framing, NPC actions, pacing, hidden quest framework, and player-facing consequences.
- DC, modifier, advantage/disadvantage, and stakes before calling `roll_check`.
- Adding player-facing narration and next choices to an Engine-provided resolution before asking Engine to commit it.

Installed Anify character plugins own:

- Character voice, goals, fears, emotional response, habits, values, and interpersonal reactions.
- Character-facing memory decisions through Engine MCP.

Character plugins must not:

- Retcon GM facts.
- Choose or alter D20 outcomes.
- Reveal hidden GM notes.
- Force the user to take an action.

## Stable Packets

Use these packets internally between phases. Keep field names stable.

### TurnPacket

```json
{
  "turn_id": "string",
  "scene_id": "string",
  "visible_scene": "player-facing scene summary",
  "world_state_delta": {},
  "available_options": ["option 1", "option 2", "option 3"],
  "custom_action_allowed": true,
  "pending_user_action": null
}
```

### CheckRequest

```json
{
  "actor": "character or party",
  "action": "attempted action",
  "ability": "ability or skill label",
  "dc": 15,
  "modifier": 2,
  "advantage": "normal",
  "stakes": "success and failure consequences",
  "secret": false
}
```

### CheckResult

The D20 MCP returns this shape. Persist it without rewriting roll fields.

```json
{
  "operation_id": "effective operation id",
  "check_id": "uuid",
  "timestamp": "UTC timestamp",
  "uid": "authenticated Firebase uid",
  "adventure_session_id": "active adventure session id",
  "revision": 4,
  "actor": "string",
  "action": "string",
  "ability": "string",
  "stakes": "string",
  "secret": false,
  "dc": 15,
  "modifier": 2,
  "advantage": "normal",
  "rolls": [13],
  "kept_roll": 13,
  "total": 15,
  "margin": 0,
  "outcome": "success"
}
```

### EngineResolution

`anify_resolve_action` reads the authenticated canonical save, returns only the information needed for narration, and retains the revision-bound resolution inside Engine:

```json
{
  "actionKind": "investigate",
  "outcome": "success",
  "checkResult": {
    "outcome": "success"
  },
  "ruleAdvice": "Resolve investigate as successful and update the remote save."
}
```

The GM calls `anify_apply_gm_resolution` with a separate presentation-only resolution containing `type: "adventure"`, visible `narrative`, exactly three normal-turn `choices`, and justified persisted effects: `items` for known world items using only `{ "itemId": "<Engine world item id>", "quantity": <positive integer> }`, `questOffers` for player-selectable dynamic quests, `flags` as a JSON string array of boolean story-flag IDs such as `["violet-crystal-source-identified"]`, and `relationChanges` for character relationships. Never put names, descriptions, kinds, slots, or invented IDs in `items`; Engine owns item metadata. Never send `flags` as an object map. Engine merges the presentation resolution with its pending rule state in one atomic commit.

After a successful commit, `ITEM_GIVE` may project a committed item. It is the only persisted-effect Web marker and is forbidden without the matching committed item. Quest offers remain pending until the player accepts, rejects, or shelves them through Engine; the Web task panel reads them from canonical state. Flags, relationships, quest state, and numerical changes have no standalone Web marker.

Every logical user or GM turn starts with the read-only `anify_begin_operation`. Engine returns the unfinished operation ID when pending work exists; otherwise it creates the current turn ID. Retain that ID and pass it as a required top-level argument to every mutation in the turn. Shell additionally sends its trusted run ID through `x-anify-operation-id`; that header takes precedence inside Engine when present, but the argument remains required. Never invent or rotate an operation ID.

Every GM turn then calls the read-only `anify_pending_turn_get` before loading or advancing the scene. A pending `check` must continue through `anify_resolve_action` with its exact returned `action` and full `check_result`. For a pending `resolution`, read canonical context if needed and commit a presentation-only resolution through `anify_apply_gm_resolution`; Engine supplies its stored rule state. Do not reroll, discard pending work, or start a new normal turn while pending work exists.

### CharacterReaction

The character phase must return either the exact internal token:

```text
NO_REPLY
```

or this object:

```json
{
  "mode": "spoken | internal | action",
  "text": "in-character reaction",
  "memory_updates": [],
  "consistency_notes": []
}
```

This packet is internal orchestration data. Never print `NO_REPLY`, the JSON object, `memory_updates`, or `consistency_notes` in player-facing output. Convert a visible reaction into ordinary scene prose; omit it entirely for `NO_REPLY`.

## Turn Execution

### One-time opening

If `save.adventure.opening_pending` is true, commit the opening before returning it:

1. Read fresh world context and the canonical save.
2. Write the visible opening narration and exactly three choices.
3. Call `anify_apply_gm_resolution` with the logical turn's `operation_id` and a minimal `adventure` resolution containing only `type`, `narrative`, and `choices`; Engine owns the opening rule state and turn entry.
4. Only after the commit succeeds, return the same narration followed by the matching `CHOICES` marker.

The opening has no preceding player action, so it does not call `roll_check` or `anify_resolve_action`. Never output an opening while `opening_pending` remains uncommitted.

### Player action turns

1. Call `anify_begin_operation` and retain its returned `operation_id`.
2. Call `anify_pending_turn_get`; recover its exact pending check or resolution before starting a new normal turn. Read-only canonical state/context calls remain available while completing recovery.
3. Call `anify_save_get`.
4. Call `anify_get_context` if fresh world context is needed.
5. GM builds or updates `TurnPacket`.
6. GM presents scene prose and emits exactly three options through the line-level `CHOICES` marker.
7. User chooses or writes a custom action.
8. GM creates `CheckRequest`.
9. Codex calls `roll_check` with the turn's `operation_id`.
10. Codex calls `anify_resolve_action` with that same `operation_id`.
11. Active character plugins return `NO_REPLY` or `CharacterReaction`; without active character plugins, GM may produce an NPC or companion reaction when appropriate.
12. Codex calls `anify_apply_gm_resolution` with the same `operation_id` and a presentation-only resolution containing visible narrative, choices, and justified persisted effects, optionally including compact durable GM or party memories. Engine binds its stored revision, rule delta, and turn entry.
13. GM presents the next scene and ends with `CHOICES`, `BATTLE`, or `ADVENTURE_END` according to the Web output contract.

To start combat as a GM consequence, add `battle: { "enemyId": "<Engine enemy id>" }` to the adventure resolution, set `choices` to `[]`, and apply that resolution once. A `BATTLE` marker is valid only when the same successful `anify_apply_gm_resolution` response already contains the matching active battle state. Never issue a later `battle.start` command.

For deterministic actions inside an active battle, call `anify_game_action` only after fresh canonical state shows both a non-null `battleState` and `resumeCheckpoint.stateNode` exactly equal to `battle.await_action`. An enemy mentioned only in narration remains an uncertain adventure action and must use the D20 flow. Codex-client attacks, skills, items, and flee operations use the same canonical state as Web's browser action endpoint.

## GM Narration Rules

- Follow `web-output-contract.md` for every player-facing response; internal packets are never part of visible output.
- Make consequences follow both the check result and established fiction.
- Let failures move the story forward with cost, complication, lost time, danger, resource pressure, or changed relationships.
- Critical success should add a bonus beyond ordinary success.
- Critical failure should add a serious but playable complication.
- Do not over-explain mechanics in scene prose.
- Keep hidden quest details private.
