# Engine MCP Gameplay Commands

Use this reference when a player directly asks the Codex plugin to inspect or change deterministic gameplay state. These natural-language operations provide the same canonical Engine capabilities that Anify Web exposes through controls.

## Request Flow

For every logical turn:

1. Call `anify_begin_operation` and retain its `operation_id`.
2. Call `anify_pending_turn_get` and finish pending GM work before any new request.
3. Call `anify_save_get` to read the canonical save.
4. Use `anify_get_context` when a target ID or world fact is needed.
5. For a read-only request, answer from `anify_save_get` and `anify_get_context`. A single matching `*.show` command below may be used when its Engine-formatted view is useful and no mutation is needed.
6. For a deterministic mutation, call `anify_game_action` once with the retained `operation_id` and one command below.
7. Render only clean player-visible prose and any justified markers under the main Skill's Player-Facing Output contract.

For a composite read-only request such as “show my inventory, equipped gear, and stats,” use the one `anify_save_get` projection instead of issuing multiple `*.show` commands. Do not call a read-only `*.show` command before a mutation in the same logical turn: Engine permits one idempotent `game-action` stage per operation. Use `anify_save_get` and `anify_get_context` for preflight lookup, then execute the one mutation. The mutation response already contains the updated canonical save.

If the user requests multiple state changes at once, do not silently execute a partial batch. Ask them to choose the first change because Engine mutations are one deliberate action per turn.

These deterministic requests are administrative gameplay actions. Do not run a D20 check or an adventure resolution for them.

## Character And Equipment

- View character stats and equipped gear: `character.show`
- Equip owned gear: `character.equip <equipmentId>`
- Unequip gear: `character.unequip <equipmentId>`

`equipmentId` is the exact canonical inventory `itemId` for an equipment entry. The displayed ATK, DEF, SPD, CRIT, EVA, RES, effective HP/MP caps, and next-level EXP come from Engine. Never recompute them in prose. When suggesting an equip action, identify owned equipment candidates but do not promise that a mutation will succeed; Engine validates slot, level, ownership, and replacement rules when the player acts.

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

## Map And Non-Visual Exploration

- View the current map: `map.show`
- List worlds or realms: `map.worlds` or `map.realms`
- List regions in a realm: `map.regions <realmId>`
- Inspect an area, region, or realm: `map.info <id>`
- View current-area interactions: `explore.show`
- Start the selected adjacent adventure from a town: call `anify_start_adventure` with `session_intent: "new"` and that exact `area_id`; do not route this through `anify_game_action`
- Inspect all items sold in the current town: `explore.shop`
- Buy from a present merchant: `explore.buy <shopItemId> [quantity]`
- Sell to a present merchant: `explore.sell <itemId> [quantity]`
- Return from the active adventure by consuming a Return Scroll: `adventure.return`

The direct Codex plugin does not render or control the Web Gaussian-splat scene. It still resolves the same exploration state through Engine MCP and returns the Web contract's clean visible prose.

Town mode has no GM narration and no built-in character interaction. Character dialogue is available only through an installed matching Anify character plugin. There is no `explore.talk` command. Never call `map.travel`, `map.enter`, `state.*`, `adventure.enter`, or `adventure.leave`; starting an adjacent adventure, GM-settled completion or death, and `adventure.return` are the only location transitions.

## Non-Visual Battle

- View the active battle and valid options: `battle.show`
- Basic attack: `battle.attack [enemyId]`
- Use a learned Engine ability: `battle.skill <abilityId|number> [enemyId]`
- Use a battle item: `battle.item <itemId> [enemyId]`
- Attempt to flee: `battle.flee`

Never call `battle.start` after a GM consequence. Adventure combat begins only through the battle object in the successful `anify_apply_gm_resolution` commit. Report HP, resources, enemies, available skills/items, cooldowns, rewards, victory, defeat, or escape only from the Engine response.

## Character Chat And Memory

Installed character plugins continue to use `anify_memory_search` and `anify_memory_remember` for relationship continuity. Without a matching installed character plugin, the GM plugin must not simulate that party member's dialogue or reactions. This is separate from memory image/video generation, which is not offered by the direct Codex plugin.
