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

## D20 Check Card

After every non-secret D20 turn is successfully committed, emit exactly one `SYSTEM_MESSAGE` marker for the Web check card. Use the exact `CheckResult` fields and this mapping:

- `critical_success` outcome → `critical_success` tier.
- `success` outcome → `success_with_cost` tier. This is the Web card's ordinary-success visual tier; do not invent a cost when Engine did not return one.
- `failure` or `critical_failure` outcome → `failure` tier.

Set `title` to the exact Engine `ability`. Set `description` to `<total> vs DC <dc> — <outcome>.` using the exact Engine values. Example:

```text
[SYSTEM_MESSAGE: {"tier":"success_with_cost","title":"Wisdom (Perception)","description":"15 vs DC 14 — success."}]
```

Do not render a Markdown line such as `**Check: Wisdom (Perception) 15 vs DC 14 — success.**` on Web, and do not duplicate the card result in prose. When `secret` is true, omit the marker and narrate only the consequence without the raw roll or DC.

Effect markers must match the already successful Engine commit:

- `ITEM_GIVE` projects an entry confirmed in the successful commit, including a GM-authored `resolution.items` entry containing only the Engine world `itemId` and a positive integer `quantity`; Engine supplies its canonical metadata.
- `QUEST_OFFER` projects an entry committed through `resolution.questOffers`; the player decides it through the Engine-backed task panel.
- `FLAG_SET` projects a flag confirmed in the successful commit, including one submitted through the `resolution.flags` JSON string array. The marker payload remains the separate `{ "key": "flag-id", "value": true }` display projection.
- `STATUS_UPDATE` projects a numerical change confirmed in the successful Engine commit; it never creates or changes that value.

Never emit an effect marker only for display. If its matching mutation is absent from the successful `anify_apply_gm_resolution` response, omit the marker.

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

Before emitting it, commit one adventure resolution with `battle: { "enemyId": "corrupted-forest-wolf" }` and `choices: []`. The successful apply response must already contain the matching active battle state. Never call `anify_game_action battle.start` afterward.

Do not narrate the battle outcome, emit `CHOICES`, grant loot, or set defeat flags in the same turn as `BATTLE`.

When the adventure ends, end with `ADVENTURE_END` instead of `CHOICES`:

```text
[ADVENTURE_END: {"outcome":"success","flagsSet":["forest-cleared"]}]
```

`outcome` must be `success`, `failure`, or `retreat`.
