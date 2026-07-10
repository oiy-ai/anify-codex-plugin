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
  "check_id": "uuid",
  "timestamp": "UTC timestamp",
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

`anify_resolve_action` reads the authenticated canonical save and returns rule advice plus a revision-bound resolution. Codex may fill only its presentation fields before submitting it to `anify_apply_gm_resolution`:

```json
{
  "actionKind": "investigate",
  "outcome": "success",
  "checkResult": {
    "outcome": "success"
  },
  "ruleAdvice": "Resolve investigate as successful and update the remote save.",
  "resolution": {
    "type": "adventure",
    "revision": 4,
    "narrative": "",
    "choices": [],
    "flags": []
  },
  "turn_entry": {
    "action": "Search the grove",
    "actionKind": "investigate",
    "outcome": "success",
    "check_result": {
      "outcome": "success"
    },
    "rule_advice": "Resolve investigate as successful and update the canonical save."
  }
}
```

The GM must not alter `type`, `revision`, check data, or Engine-generated mechanical effects. It may add the visible `narrative`, exactly three normal-turn `choices`, and marker effects explicitly justified by Engine context. `anify_apply_gm_resolution` is the only commit for this packet.

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

This packet is internal orchestration data. Never print `NO_REPLY`, the JSON object, `memory_updates`, or `consistency_notes` in the final Web response. Convert a visible reaction into ordinary scene prose; omit it entirely for `NO_REPLY`.

## Turn Execution

### One-time opening

If `save.adventure.opening_pending` is true, commit the opening before returning it:

1. Read fresh world context and `save.game.resumeCheckpoint.revision`.
2. Write the visible opening narration and exactly three choices.
3. Call `anify_apply_gm_resolution` with an `adventure` resolution at that exact revision and a compact opening `turn_entry`.
4. Only after the commit succeeds, return the same narration followed by the matching `CHOICES` marker.

The opening has no preceding player action, so it does not call `roll_check` or `anify_resolve_action`. Never output an opening while `opening_pending` remains uncommitted.

### Player action turns

1. Call `anify_save_get`.
2. Call `anify_get_context` if fresh world context is needed.
3. GM builds or updates `TurnPacket`.
4. GM presents scene prose and emits exactly three options through the line-level `CHOICES` marker.
5. User chooses or writes a custom action.
6. GM creates `CheckRequest`.
7. Codex calls `roll_check`.
8. Codex calls `anify_resolve_action`.
9. Active character plugins return `NO_REPLY` or `CharacterReaction`; without active character plugins, GM may produce an NPC or companion reaction when appropriate.
10. Codex adds visible narrative and choices to Engine's resolution and calls `anify_apply_gm_resolution`, optionally including compact durable GM or party memories.
11. GM presents the next scene and ends with `CHOICES`, `BATTLE`, or `ADVENTURE_END` according to the Web output contract.

For deterministic UI-style operations, call `anify_game_action`. A `BATTLE` marker is valid only after `anify_game_action` successfully runs `battle.start <enemyId>`. Subsequent Codex-client attacks, skills, items, and flee operations also use `anify_game_action`, exactly like Web uses Engine's browser action endpoint.

## GM Narration Rules

- Follow `web-output-contract.md` for every player-facing response; internal packets are never part of visible output.
- Make consequences follow both the check result and established fiction.
- Let failures move the story forward with cost, complication, lost time, danger, resource pressure, or changed relationships.
- Critical success should add a bonus beyond ordinary success.
- Critical failure should add a serious but playable complication.
- Do not over-explain mechanics in scene prose.
- Keep hidden quest details private.
