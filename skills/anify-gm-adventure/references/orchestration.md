# Anify Orchestration

This protocol keeps Engine rules, GM narration, and Character AI independently evolvable.

## Authority Boundaries

Engine MCP owns:

- Firebase-gated tool access.
- Remote GM save state through `anify_save_get` and `anify_save_update`.
- Character long-term memory through `anify_memory_search` and `anify_memory_remember`.
- World context loaded from Engine KV.
- D20 check results.
- Deterministic rule advice and state deltas.

GM AI owns:

- Scene framing, NPC actions, pacing, hidden quest framework, and player-facing consequences.
- DC, modifier, advantage/disadvantage, and stakes before calling `roll_check`.
- Translating Engine deltas into compact remote save patches.

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

`anify_resolve_action` returns rule advice and deltas for Codex to apply with `anify_save_update`:

```json
{
  "actionKind": "investigate",
  "outcome": "success",
  "stateDelta": {
    "player": {},
    "inventory": [],
    "flags": []
  },
  "ruleAdvice": "Resolve investigate as successful and update the remote save."
}
```

### CharacterReaction

The character phase must output either the exact token:

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

## Turn Execution

1. Call `anify_save_get`.
2. Call `anify_get_context` if fresh world context is needed.
3. GM builds or updates `TurnPacket`.
4. GM presents scene and exactly three options.
5. User chooses or writes a custom action.
6. GM creates `CheckRequest`.
7. Codex calls `roll_check`.
8. Codex calls `anify_resolve_action`.
9. Active character plugins return `NO_REPLY` or `CharacterReaction`; without active character plugins, GM may produce an NPC or companion reaction when appropriate.
10. Codex calls `anify_save_update` with compact state/progress/memory changes and the turn entry.
11. GM presents the next scene and choices.

## GM Narration Rules

- Make consequences follow both the check result and established fiction.
- Let failures move the story forward with cost, complication, lost time, danger, resource pressure, or changed relationships.
- Critical success should add a bonus beyond ordinary success.
- Critical failure should add a serious but playable complication.
- Do not over-explain mechanics in scene prose.
- Keep hidden quest details private.
