# Engine MCP Gameplay Commands

Use this reference when a player directly asks the Codex plugin to inspect or change deterministic gameplay state. These natural-language operations provide the same canonical Engine capabilities that Anify Web exposes through controls.

## Request Flow

Classify the request before entering a transaction:

1. For a read-only request, call `anify_save_get` once when a fresh canonical view is needed and answer from that projection; do not begin an operation or recover/advance a gameplay turn. Use `anify_get_context` only for missing facts.
2. For a deterministic mutation, call `anify_begin_operation` once and reuse its returned save, pending state and `operation_id` from the [Turn Operation Protocol](../SKILL.md#turn-operation-protocol). Do not separately call `anify_pending_turn_get` or `anify_save_get`.
3. If recovery committed a pending GM turn, present it and end the response.
4. Use `anify_get_context` when a target ID or world fact is missing or stale.
5. Call `anify_game_action` once with the retained `operation_id` and one command below.
6. Render only clean player-visible prose and any justified markers under the main Skill's Player-Facing Output contract. Reuse the mutation response's canonical save; no verification read is needed.

For a composite read-only request such as “show my inventory, equipped gear, and stats,” use the one `anify_save_get` projection instead of issuing multiple `*.show` commands. Do not call a read-only `*.show` command before a mutation in the same logical turn: Engine permits one idempotent `game-action` stage per operation. Use `anify_save_get` and `anify_get_context` for preflight lookup, then execute the one mutation. The mutation response already contains the updated canonical save.

If the user requests multiple state changes at once, do not silently execute a partial batch. Ask them to choose the first change because Engine mutations are one deliberate action per turn.

These deterministic requests are player gameplay actions. Do not run a D20 check or an adventure resolution for them; present their results with the main Skill's player-facing labels, not an implementation report.

## Character And Equipment

- View character stats and equipped gear: `character.show`
- Equip owned gear: `character.equip <equipmentId>`
- Unequip gear: `character.unequip <equipmentId>`

`equipmentId` is the exact canonical inventory `itemId` for an equipment entry. The displayed ATK, DEF, SPD, CRIT, EVA, RES, effective HP/MP caps, and next-level EXP come from Engine. Never recompute them in prose. When suggesting an equip action, identify owned equipment candidates but do not promise that a mutation will succeed; Engine validates slot, level, ownership, and replacement rules when the player acts.

## Inventory

Web inventory use and the adventure return button submit one ordinary user message in this format: `Use item: {"itemId":"return-scroll","name":"Return Scroll"}` (Chinese: `使用道具：{"itemId":"return-scroll","name":"回程卷轴"}`). Treat it as one deterministic item-use request in the current GM thread, just like a player asking in free text. Validate the ID against the canonical inventory; the supplied name is only a display label, never authority for effects. Use `adventure.return` for `return-scroll`, otherwise `inventory.use <itemId>` outside battle. Begin one operation and execute one game action through the flow above; do not call `roll_check`, advance the fictional scene, or apply a separate GM resolution. Report the actual Engine outcome without a D20 check card. If the adventure remains active, retain its committed choices; on successful return emit `ADVENTURE_END` with outcome `retreat`. Rejected use consumes no item and must not be narrated as success.

- View inventory and pending rewards: `inventory.show`
- Claim pending rewards that fit: `inventory.claim`
- Inventory has 100 slots. Stackable catalog items hold up to 100 per slot; equipment and nonstackable items occupy one slot each. Rewards that do not fit remain pending until claimed. Purchases require space for the entire quantity and do not charge on failure.
- Use an out-of-battle consumable: `inventory.use <itemId>`
- Drop items: `inventory.drop <itemId> [quantity]`

Use exact IDs from the canonical inventory. During battle, use `battle.item`, not `inventory.use`.

## Quests

- View active quests and pending offers: `quest.active`
- Inspect one quest: `quest.info <questId>`
- Accept a pending GM offer: `quest.offer-accept <questId>`
- Reject a pending GM offer: `quest.offer-reject <questId>`
- Shelve a pending GM offer: `quest.offer-shelve <questId>`

There are no `quest.complete`, `quest.force-complete`, `quest.accept`, or `state.*` commands. Accept pending offers only through `quest.offer-accept`. Active quests complete and grant rewards automatically in the same Engine transaction that satisfies their conditions; persist GM-authored state only through the transactional resolution tools.

## Map And Non-Visual Exploration

- View the current map: `map.show`
- List worlds or realms: `map.worlds` or `map.realms`
- List regions in a realm: `map.regions <realmId>`
- Inspect an area, region, or realm: `map.info <id>`
- View current-area interactions: `explore.show`
- In Web, entering an adjacent adventure area is an Engine-backed UI transition that updates `currentAreaId` before Anify-GM runs. When the current area is an adventure and no session is active, call `anify_start_adventure` with `session_intent: "new"` and that exact current `area_id`
- In direct Codex town mode, show the Engine-backed adjacent adventure interactions and wait for the player to choose an exact destination; after that explicit choice, call `anify_start_adventure` with the selected adjacent `area_id`; never invent or auto-select one
- Inspect all items sold in the current town: `explore.shop`
- Buy from the current town's catalog: `explore.buy <itemId> [quantity]`
- Sell an owned item: `explore.sell <itemId> [quantity]`
- Return from the active adventure by consuming a Return Scroll: `adventure.return`
- View the active adventure log and current choices: `adventure.show`

The direct Codex plugin does not render or control the Web Gaussian-splat scene. It still resolves the same exploration state through Engine MCP and returns the Web contract's clean visible prose.

Town mode has no GM narration and no built-in character interaction. Character dialogue is available only through an installed matching Anify character plugin. Determine town mode from the current area's Engine type, not from `save.game.adventure` alone. There is no `explore.interact` command. There are no `explore.talk`, `map.travel`, `map.enter`, `state.*`, `adventure.enter`, or `adventure.leave` commands; the Engine-backed Web entry transition, starting the exact current adventure area, GM-settled completion or death, and `adventure.return` are the only location transitions.

For purchases, resolve the current town's `shopItemIds` against world `items` and pass the exact item ID. Do not invent a separate shop-entry ID or use a global shop list. Engine validates town availability, battle state, quantity, price and available gold. Use its response for the transaction result.

## Non-Visual Battle

- View the active battle and valid options: `battle.show`
- Basic attack: `battle.attack [enemyId]`
- Use a learned Engine ability: `battle.skill <abilityId|number> [enemyId]`
- Use a battle item: `battle.item <itemId> [enemyId]`
- Attempt to flee: `battle.flee`

There is no `battle.start` command. Adventure combat begins only through the battle object in the successful `anify_apply_gm_resolution` commit. Report HP, resources, enemies, available skills/items, cooldowns, rewards, victory, defeat, or escape only from the Engine response.

## Character Chat And Memory

Installed character plugins continue to use `anify_memory_search` and `anify_memory_remember` for relationship continuity. Without a matching installed character plugin, the GM plugin must not simulate that party member's dialogue or reactions. This is separate from adventure media generation, available through `$anify-adventure-image` and `$anify-adventure-video`.
