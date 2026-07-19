# Native Codex Client Gameplay

Use this reference only for the native Codex text surface. It maps natural player requests to the same canonical Engine commands used by Anify Web controls.

## Request Flow

For every logical client turn:

1. Call `anify_begin_operation` and retain its `operation_id`.
2. Call `anify_pending_turn_get` and finish pending GM work before any new request.
3. Call `anify_save_get` to read the canonical save.
4. Use `anify_get_context` when a target ID or world fact is needed.
5. For a deterministic gameplay request, call `anify_game_action` once with the retained `operation_id` and one command below.
6. Render the returned result under `codex-client-output-contract.md`.

Do not call a read-only `*.show` command before a mutation in the same logical turn: Engine permits one idempotent `game-action` stage per operation. Use `anify_save_get` and `anify_get_context` for preflight lookup, then execute the one mutation. The mutation response already contains the updated canonical save.

If the user requests multiple state changes at once, do not silently execute a partial batch. Ask them to choose the first change because Engine mutations are one deliberate action per turn.

These deterministic requests are administrative gameplay actions. Do not run a D20 check or an adventure resolution for them.

## Character And Equipment

- View character stats and equipped gear: `character.show`
- Equip owned gear: `character.equip <equipmentId>`
- Unequip gear: `character.unequip <equipmentId>`

The displayed ATK, DEF, SPD, CRIT, EVA, RES, effective HP/MP caps, and next-level EXP come from Engine. Never recompute them in prose.

## Inventory

- View inventory: `inventory.show`
- Use an out-of-battle consumable: `inventory.use <itemId>`
- Drop items: `inventory.drop <itemId> [quantity]`

Use exact IDs from the canonical inventory. During battle, use `battle.item`, not `inventory.use`.

## Quests

- View active quests and pending offers: `quest.active`
- Inspect one quest: `quest.info <questId>`
- Accept a pending GM offer: `quest.offer-accept <questId>`
- Reject a pending GM offer: `quest.offer-reject <questId>`
- Shelve a pending GM offer: `quest.offer-shelve <questId>`
- Complete a currently completable quest: `quest.complete <questId>`

Never use `quest.force-complete` or any `state.*` command; those are internal Engine bridges, not player capabilities.

## Map, Travel, And Text Exploration

- View the current map: `map.show`
- List worlds or realms: `map.worlds` or `map.realms`
- List regions in a realm: `map.regions <realmId>`
- Inspect an area, region, or realm: `map.info <id>`
- Enter a realm: `map.enter <realmId>`
- Travel to an accessible location: `map.travel <areaId>`
- View current-area interactions: `explore.show`
- Talk to a present character: `explore.talk <characterId>`
- Use an interaction point: `explore.interact <pointId>`
- Buy from a present merchant: `explore.buy <shopItemId> [quantity]`
- Sell to a present merchant: `explore.sell <itemId> [quantity]`

Describe places and interactions as text. Never claim to render or control the Web Gaussian-splat scene.

## Text Battle

- View the active battle and valid options: `battle.show`
- Basic attack: `battle.attack [enemyId]`
- Use a learned Engine ability: `battle.skill <abilityId|number> [enemyId]`
- Use a battle item: `battle.item <itemId> [enemyId]`
- Attempt to flee: `battle.flee`
- After defeat, return to checkpoint: `battle.resolve-defeat town`
- After defeat, consume an owned phoenix feather: `battle.resolve-defeat feather`

Never call `battle.start` after a GM consequence. Adventure combat begins only through the battle object in the successful `anify_apply_gm_resolution` commit. Report HP, resources, enemies, available skills/items, cooldowns, rewards, victory, defeat, or escape only from the Engine response.

## Character Chat And Memory

Installed character plugins continue to use `anify_memory_search` and `anify_memory_remember` for text relationship continuity. This is separate from the unsupported Web memory image/video generation surface.
