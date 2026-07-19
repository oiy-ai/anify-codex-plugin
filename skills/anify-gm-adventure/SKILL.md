---
name: anify-gm-adventure
description: Run Anify-GM adventures and Engine-backed gameplay in Anify Web or a directly installed Codex plugin, including D20 scenes, non-visual battles, inventory, equipment, character stats, quests, maps, travel, shops, and character-party play. Use when the user invokes Anify-GM, starts or continues an adventure, or asks to inspect or change canonical Anify gameplay state through natural-language commands.
---

# Anify GM Adventure

Use this skill when the user wants to start, continue, configure, or run an AI-driven Anify TRPG adventure, DnD-style campaign, party scene, GM session, or adventure with installed Anify character plugins.

## Required References

Before running or modifying an Anify session, read:

- `references/authentication.md`
- `references/orchestration.md`
- `references/d20-mcp-contract.md`
- `references/memory-and-consistency.md`
- `references/web-output-contract.md`
- `references/engine-gameplay-commands.md`

## Operating Model

Anify Engine MCP is the only save and memory authority. Do not read or write local Anify user workspace files.

Engine MCP owns authenticated access, the canonical game state shared with Anify Web, remote character memory, world context, D20 rolls, deterministic rule advice, and every state mutation. Codex owns scene framing, DC selection, character orchestration, and player-facing narration.

## Turn Operation Protocol

At the start of every logical GM turn, before loading state or making any mutation:

1. Call the read-only `anify_begin_operation` and retain its returned `operation_id` for the entire turn. Engine returns the unfinished operation ID when pending work exists; otherwise it creates the current turn ID.
2. Call the read-only `anify_pending_turn_get` before creating a new check or resolution.
3. If Engine reports a pending `check`, continue it by calling `anify_resolve_action` with the current turn's `operation_id`, exact returned `action`, and full `check_result`. Do not call `roll_check` again. Engine retains the resulting pending resolution internally.
4. If Engine reports a pending `resolution`, read canonical save or world context if needed, then call `anify_apply_gm_resolution` with the current turn's `operation_id` and a presentation-only resolution containing narration, choices, and justified story effects. Engine binds its pending rule state atomically.
5. Only when Engine reports no pending turn may the normal opening or player-action flow begin.

Every mutating tool argument in that logical turn must include the same top-level `operation_id` returned by `anify_begin_operation`, including save initialization, adventure start, opening or normal resolution apply, D20 roll and resolution, deterministic game actions, and memory writes. In Shell runs, the trusted `x-anify-operation-id` header takes precedence inside Engine, but the `operation_id` tool argument is still mandatory. Never invent or rotate an ID inside a turn.

## Prototype Loop

Before any start or continue request:

1. Complete the Turn Operation Protocol above, including pending-turn recovery, then call `anify_save_get`.
2. If the save is not initialized, call `anify_save_initialize` with a concise default profile inferred from the user's request, then call `anify_save_get` again.
3. Read active adventure state from `save.adventure` and canonical gameplay state from `save.game`.
4. If `save.adventure` is null or the user explicitly asks to start a new adventure, call `anify_start_adventure` with `session_intent: "new"`. Pass the active character-plugin party, with at most two character IDs. When no explicit party selection exists, use the world-declared default `lynn_tale` and `lyra_oravia`. A Shell new-session request must use a new host-provided logical GM thread ID; pass it as `gm_thread_id`, otherwise omit it and never fabricate one.
5. If `save.adventure` is active and the user asks to continue, call `anify_start_adventure` once with `session_intent: "resume"`. Do not override its fixed world, area, language, party, or GM thread. Continue only when Engine returns the same active session.

When `save.adventure.opening_pending` is true, the current response is the one-time opening turn. Build the opening narration and exactly three choices, then call `anify_apply_gm_resolution` directly with the turn's `operation_id` and a minimal `adventure` resolution containing only `type`, `narrative`, and `choices`. Engine binds the canonical revision and creates the opening turn entry atomically. Do not roll a D20 and do not call `anify_resolve_action` for this opening-only turn. Emit the same committed narration and choices through the Web output contract only after the Engine commit succeeds. This successful commit is what clears `opening_pending`; never return an uncommitted opening.
6. If an Engine MCP call fails because authorization is missing or expired, surface that failure directly and let the Codex host reconnect Anify.

After the Turn Operation Protocol reports no pending turn, run the normal active-turn flow in this exact order:

1. **Load canonical state**: call `anify_save_get` and treat `save.game` as the only gameplay state.
2. **Engine context**: call `anify_get_context` when area, world, quest, enemy, or character facts are needed.
3. **GM narration**: describe the current fiction, immediate stakes, and relevant sensory detail.
4. **GM options**: choose exactly three viable options and emit them only through the Web `CHOICES` marker.
5. **User action**: wait for or parse the user's selected/custom action.
6. **D20 check**: GM chooses ability/skill, DC, modifier, advantage state, and stakes, then calls `roll_check` with the turn's `operation_id`. The GM must not invent the D20 result.
7. **Engine rule resolution**: call `anify_resolve_action` with the same `operation_id`, the user action, and exact full `roll_check` result. Engine returns the action kind, outcome, check result, and rule advice while retaining revision and rule deltas internally. Do not submit a client-authored save or call it without `check_result`.
8. **Character AI reaction**: if Anify character plugins are active, let those persona instructions control character speech. If no character plugin is active, produce an NPC or companion reaction only when fiction calls for it; otherwise use the internal token `NO_REPLY`. Never expose `NO_REPLY` in player-facing output.
9. **Commit the turn**: call `anify_apply_gm_resolution` with the same `operation_id` and a presentation-only resolution containing `type`, narrative, exactly three normal-turn choices, and only justified persisted effects under the mapping below. Engine supplies the stored revision, rule delta, and turn entry. Pass compact durable GM or party memories with that same call when needed. Never patch `save.game` directly.
10. **GM advancement**: present the consequence and end with the next `CHOICES`, `BATTLE`, or `ADVENTURE_END` marker under the Web output contract.

### Persisted effect mapping

Engine mutations always precede their player-facing projection. `ITEM_GIVE` is the only persisted-effect Web marker:

- Never send `revision` or `ruleDelta`; Engine applies its stored values. Never author HP, MP, EXP, gold, D20 inventory deltas, or D20 flags.
- Before granting any item, call `anify_get_context` with the active `world_id` and a concise `catalog_query`. Select the exact `itemId` only from its `catalog_matches`; if there is no match, omit the inventory gain. Never search GitHub, plugin files, or asset manifests for item IDs.
- Put the matched world item in `resolution.items` as `{ "itemId": "<Engine world item id>", "quantity": <positive integer> }`. Do not add names, descriptions, kinds, slots, or invented item IDs; Engine resolves all item metadata from the world catalog. Commit it, then emit the matching `ITEM_GIVE` marker.
- Put a new dynamic quest in `resolution.questOffers` and commit it. The Web task panel reads the canonical Engine quest; there is no quest marker. The player accepts, rejects, or shelves it through Engine; never auto-accept it.
- Put justified boolean story-flag IDs in `resolution.flags` as a JSON string array, for example `["violet-crystal-source-identified"]`. Never send an object map such as `{ "flag-id": true }`. Flags have no standalone Web marker.
- Put justified relationship effects in `resolution.relationChanges`; they have no standalone Web marker.
- Numerical changes come only from Engine rule resolution and have no standalone Web marker.

Never describe an item, quest, flag, relationship, or numerical effect unless it is already present in the successful `anify_apply_gm_resolution` response. Never emit a marker outside the five exact shapes in `references/web-output-contract.md`.

When a GM consequence starts combat, set `resolution.battle` to `{ "enemyId": "<Engine enemy id>" }`, set `resolution.choices` to `[]`, and commit that adventure resolution once through `anify_apply_gm_resolution`. Emit `BATTLE` only when the successful response already contains the matching `save.game.battleState` and `battle.await_action` checkpoint. Never follow it with `anify_game_action battle.start`; battle creation, narrative, turn log, and memories are one Engine commit.

Call deterministic `battle.*` actions only when fresh `anify_save_get` state has both a non-null `save.game.battleState` and `save.game.resumeCheckpoint.stateNode` exactly equal to `battle.await_action`. An enemy mentioned in narration does not establish battle state. If this gate is false, treat an attempted strike or other uncertain action as an adventure D20 turn and never call `anify_game_action battle.*`. Codex-client battle commands and Web battle buttons therefore operate on the same canonical battle.

The `.mcp.json` header mapping lets Shell transport its trusted run ID as `x-anify-operation-id`; native Codex clients rely on `anify_begin_operation`. Both paths still require the returned `operation_id` in every mutation argument. Engine replays matching committed stages and uses `anify_pending_turn_get` to recover an unfinished check or resolution without rerolling.

Do not skip the D20 check after an uncertain fictional action. Deterministic gameplay requests documented in `references/engine-gameplay-commands.md`, such as viewing inventory, equipping an item, accepting a quest, travelling, or taking a numerical battle action, call `anify_game_action` instead and do not run a D20 turn. The one-time committed opening above is not a user action and is the only opening-specific exception.

## Player-Facing Output

The Web contract in `references/web-output-contract.md` is mandatory in both Codex Shell and directly installed Codex plugins. Keep the player-facing output compact:

- Write a short scene paragraph as clean visible text.
- After every non-secret D20 check, emit exactly one `SYSTEM_MESSAGE` marker using the exact mapping in `references/web-output-contract.md`; never print a Markdown `Check:` summary.
- Do not print numbered or bulleted options in prose.
- End a normal adventure turn with exactly one line-level `CHOICES` marker containing exactly three strings.
- Do not print a separate custom-action prompt; the Web input already accepts custom actions.
- Fulfil direct Codex requests for inventory, equipment, character, quest, map, travel, shop, non-visual exploration, and non-visual battle through `references/engine-gameplay-commands.md`, while retaining this same Web output format.
- Do not offer visual battle, Gaussian-splat exploration, or memory image/video generation in the directly installed Codex plugin.

After the user acts and the D20 result is available, emit the Web check card, any justified character reaction, the consequence, and the next Web marker or terminal state.

Never expose hidden quest framework details, private GM notes, raw remote memory internals, or secret DC reasoning unless the user explicitly asks to inspect GM state.
