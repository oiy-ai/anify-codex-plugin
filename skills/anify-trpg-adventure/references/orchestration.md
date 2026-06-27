# Anify Orchestration

This protocol keeps the GM AI and Character AI independently evolvable. The GM may change rules, pacing, and campaign state without rewriting character internals. The Character AI may improve memory, style, and consistency without changing world authority.

## Authority Boundaries

GM AI owns:

- World book facts, scene facts, NPC actions, factions, locations, timeline, inventory availability, and environmental constraints.
- Rule interpretation, DC selection, modifiers, advantage/disadvantage, stakes, and check requests.
- Hidden quest framework, secrets, clocks, encounter progress, rewards, and consequences.
- Canonical campaign state and session log.

Character AI owns:

- Character voice, memories, goals, fears, emotional response, habits, values, and interpersonal reactions.
- Suggestions for likely in-character behavior.
- Consistency checks against the configured persona.
- Character-facing memory updates.

Character AI must not:

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

### CharacterReactionRequest

```json
{
  "character_id": "string",
  "visible_scene": "current visible scene",
  "user_action": "selected or custom action",
  "check_result": {},
  "recent_memory": [],
  "persona_controls": {},
  "reply_budget": "short"
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

1. GM builds or updates `TurnPacket`.
2. GM presents scene and exactly three options to the user.
3. User chooses or writes a custom action.
4. GM creates `CheckRequest`.
5. Codex calls D20 MCP `roll_check`.
6. GM records `CheckResult`.
7. Character AI receives `CharacterReactionRequest`.
8. Character AI returns `NO_REPLY` or `CharacterReaction`.
9. GM applies consequences, updates state, writes memory, and presents the next scene.

## GM Narration Rules

- Make consequences follow both the check result and the established fiction.
- Let failures move the story forward with cost, complication, lost time, danger, resource pressure, or changed relationships.
- Critical success should add a bonus beyond ordinary success.
- Critical failure should add a serious but playable complication.
- Do not over-explain mechanics in scene prose.
- Keep hidden quest details private.
