# Anify Orchestration

This protocol keeps Engine rules, GM narration, and Character AI independently evolvable.

## Authority Boundaries

Engine MCP owns:

- Firebase-gated tool access.
- World context loaded from Engine KV.
- D20 check results.
- Deterministic rule advice and state deltas.

GM AI owns:

- Scene framing, NPC actions, pacing, hidden quest framework, and player-facing consequences.
- DC, modifier, advantage/disadvantage, and stakes before calling `roll_check`.
- Applying Engine deltas into `save.md` and appending `turn-log.md`.
- Updating `gm-memory.md`.

Installed Anify character plugins own:

- Character voice, memories, goals, fears, emotional response, habits, values, and interpersonal reactions.
- Character-facing memory updates in their own `CODEX_HOME/anify/users/userA/<Character>` workspaces.

Character plugins must not:

- Retcon GM facts.
- Choose or alter D20 outcomes.
- Reveal hidden GM notes.
- Force the user to take an action.

## Local Markdown Files

Use these files under `CODEX_HOME/anify/users/userA/GM`:

- `profile.md`: stable player and character profile.
- `progress.md`: durable cross-adventure progress, completed adventure outcomes, unresolved hooks, and next-adventure seeds.
- `save.md`: current world, location, player stats, inventory, quests, flags, and active scene summary.
- `gm-memory.md`: durable GM-facing campaign memory and hidden continuity notes.
- `party-memory.md`: party-facing episodic and relationship memory known in the current adventure.
- `turn-log.md`: append-only chronological visible turn log.

Do not create missing files during GM play. Missing save files mean Anify Installer or Web initialization has not completed yet.

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

`anify_resolve_action` returns rule advice and deltas for Codex to apply to Markdown:

```json
{
  "actionKind": "investigate",
  "outcome": "success",
  "stateDelta": {
    "player": {},
    "inventory": [],
    "flags": []
  },
  "ruleAdvice": "Resolve investigate as successful and update the local Markdown save."
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

1. Read local Markdown state.
2. Call `anify_get_context` if fresh world context is needed.
3. GM builds or updates `TurnPacket`.
4. GM presents scene and exactly three options.
5. User chooses or writes a custom action.
6. GM creates `CheckRequest`.
7. Codex calls `roll_check`.
8. Codex calls `anify_resolve_action`.
9. Active character plugins return `NO_REPLY` or `CharacterReaction`; without active character plugins, GM may produce an NPC or companion reaction when appropriate.
10. Codex updates `save.md`, `gm-memory.md`, `party-memory.md`, and appends `turn-log.md`.
11. GM presents the next scene and choices.

## GM Narration Rules

- Make consequences follow both the check result and established fiction.
- Let failures move the story forward with cost, complication, lost time, danger, resource pressure, or changed relationships.
- Critical success should add a bonus beyond ordinary success.
- Critical failure should add a serious but playable complication.
- Do not over-explain mechanics in scene prose.
- Keep hidden quest details private.
