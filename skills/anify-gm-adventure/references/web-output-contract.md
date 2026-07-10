# Anify Web Output Contract

Anify Web consumes clean visible prose plus line-level structured markers. This format is a wire contract, not a stylistic suggestion.

## Visible Text

- Output only player-visible narration and dialogue. Do not mention tools, save writes, memory operations, internal packets, or reasoning.
- Keep choices out of the prose. Do not render numbered or bulleted option lists and do not add a separate line saying custom actions are allowed.
- Never print `NO_REPLY`, `TurnPacket`, `CheckRequest`, `CheckResult`, `EngineResolution`, or `CharacterReaction` objects.
- In a GM-plus-character scene, render a visible character reaction as natural narration or quoted dialogue inside the clean text. The GM contract owns the single final response envelope.

## Marker Grammar

Every marker must:

- Use ASCII square brackets and an uppercase marker name.
- Occupy its own line after any related visible prose.
- Use the exact form `[TYPE: <valid-json>]` with the complete JSON value on the same line.
- Use double-quoted JSON keys and strings, with no trailing commas, Markdown decoration, heading, bullet, or code fence.
- Reflect Engine MCP state that was already resolved and persisted. Markers are Web UI projections; they never replace the required Engine MCP tool calls.

The Web parser recognizes these exact shapes:

```text
[CHOICES: ["Option 1","Option 2","Option 3"]]
[BATTLE: {"enemyId":"enemy-id"}]
[ADVENTURE_END: {"outcome":"success","flagsSet":["flag-id"]}]
[QUEST_OFFER: {"id":"quest-id","name":"Quest name","description":"Quest description","completionConditions":[{"type":"flag_set","target":"flag-id"}]}]
[QUEST_UPDATE: {"questId":"quest-id","title":"Updated title"}]
[ITEM_GIVE: {"itemId":"item-id","quantity":1}]
[FLAG_SET: {"key":"flag-id","value":true}]
[SYSTEM_MESSAGE: {"tier":"critical_success","title":"Check title","description":"Player-visible result"}]
[STATUS_UPDATE: {"hp":-5}]
```

Use only markers justified by the current turn and only IDs returned by Engine context or resolution. `SYSTEM_MESSAGE.tier` must be `critical_success`, `success_with_cost`, or `failure`.

## Turn End Rules

A normal adventure turn must end with exactly one marker line containing exactly three concise choices:

```text
[CHOICES: ["Investigate the gate","Follow the tracks","Wait and listen"]]
```

- `CHOICES` must be the final non-empty line.
- The payload must be a JSON string array with exactly three items.
- Do not duplicate those choices in visible prose.
- Custom actions remain available through the Web input without an extra prompt line.

When combat begins, end with `BATTLE` instead of `CHOICES`:

```text
[BATTLE: {"enemyId":"corrupted-forest-wolf"}]
```

Before emitting it, commit one adventure resolution with `battle: { "enemyId": "corrupted-forest-wolf" }`, `choices: []`, and the exact Engine `resolution_packet`. The successful apply response must already contain the matching active battle state. Never call `anify_game_action battle.start` afterward.

Do not narrate the battle outcome, emit `CHOICES`, grant loot, or set defeat flags in the same turn as `BATTLE`.

When the adventure ends, end with `ADVENTURE_END` instead of `CHOICES`:

```text
[ADVENTURE_END: {"outcome":"success","flagsSet":["forest-cleared"]}]
```

`outcome` must be `success`, `failure`, or `retreat`.
