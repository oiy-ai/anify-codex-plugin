---
name: anify-gm-adventure
description: Run Anify-GM adventures with Engine MCP world context, remote GM saves, remote character memory, and mandatory D20 checks. Use when the user invokes Anify-GM, starts or continues a solo adventure, or runs an adventure with installed Anify character plugins.
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

## Operating Model

Anify Engine MCP is the only save and memory authority. Do not read or write local Anify user workspace files.

Engine MCP owns authenticated access, the canonical game state shared with Anify Web, remote character memory, world context, D20 rolls, deterministic rule advice, and every state mutation. Codex owns scene framing, DC selection, character orchestration, and player-facing narration.

## Turn Operation Protocol

At the start of every logical GM turn, before loading state or making any mutation:

1. Call the read-only `anify_begin_operation` and retain its returned `operation_id` for the entire turn.
2. Call the read-only `anify_pending_turn_get` before creating a new check or resolution.
3. If Engine reports a pending `check`, continue it by calling `anify_resolve_action` with the current turn's `operation_id`, exact returned `action`, and full `check_result`. Do not call `roll_check` again. Treat the returned resolution as the pending resolution described next.
4. If Engine reports a pending `resolution`, read canonical save or world context if needed, extend only its returned resolution's presentation fields under the normal GM rules, then call `anify_apply_gm_resolution` with the current turn's `operation_id` and exact returned `resolution_packet`. Do not reroll, resolve again, discard the packet, or replace any provenance field.
5. Only when Engine reports no pending turn may the normal opening or player-action flow begin.

Every mutating tool argument in that logical turn must include the same top-level `operation_id` returned by `anify_begin_operation`, including save initialization, adventure start, opening or normal resolution apply, D20 roll and resolution, deterministic game actions, and memory writes. In Shell runs, the trusted `x-anify-operation-id` header takes precedence inside Engine, but the `operation_id` tool argument is still mandatory. Never invent or rotate an ID inside a turn.

## Prototype Loop

Before any start or continue request:

1. Complete the Turn Operation Protocol above, including pending-turn recovery, then call `anify_save_get`.
2. If the save is not initialized, call `anify_save_initialize` with a concise default profile inferred from the user's request, then call `anify_save_get` again.
3. Read active adventure state from `save.adventure` and canonical gameplay state from `save.game`.
4. If `save.adventure` is null or the user explicitly asks to start a new adventure, call `anify_start_adventure` with `session_intent: "new"`. Pass the active character-plugin party, with at most two character IDs. When no explicit party selection exists, use the world-declared default `lynn_tale` and `lyra_oravia`. A Shell new-session request must use a new host-provided logical GM thread ID; pass it as `gm_thread_id`, otherwise omit it and never fabricate one.
5. If `save.adventure` is active and the user asks to continue, call `anify_start_adventure` once with `session_intent: "resume"`. Do not override its fixed world, area, language, party, or GM thread. Continue only when Engine returns the same active session.

When `save.adventure.opening_pending` is true, the current response is the one-time opening turn. Build the opening narration and exactly three choices, then call `anify_apply_gm_resolution` directly with the turn's `operation_id` and a minimal `adventure` resolution containing only `type`, `narrative`, and `choices`. Omit `revision`, `resolution_packet`, and `turn_entry`; Engine binds the canonical revision and creates the opening turn entry atomically. Do not roll a D20 and do not call `anify_resolve_action` for this opening-only turn. Emit the same committed narration and choices through the Web output contract only after the Engine commit succeeds. This successful commit is what clears `opening_pending`; never return an uncommitted opening.
6. If an Engine MCP call fails because authorization is missing or expired, surface that failure directly and let the Codex host reconnect Anify.

After the Turn Operation Protocol reports no pending turn, run the normal active-turn flow in this exact order:

1. **Load canonical state**: call `anify_save_get` and treat `save.game` as the only gameplay state.
2. **Engine context**: call `anify_get_context` when area, world, quest, enemy, or character facts are needed.
3. **GM narration**: describe the current fiction, immediate stakes, and relevant sensory detail.
4. **GM options**: choose exactly three viable options and emit them only through the Web `CHOICES` marker defined in `references/web-output-contract.md`.
5. **User action**: wait for or parse the user's selected/custom action.
6. **D20 check**: GM chooses ability/skill, DC, modifier, advantage state, and stakes, then calls `roll_check` with the turn's `operation_id`. The GM must not invent the D20 result.
7. **Engine rule resolution**: call `anify_resolve_action` with the same `operation_id`, the user action, and exact full `roll_check` result. Preserve its returned `resolution_packet` without changing any field. Do not submit a client-authored save or call it without `check_result`.
8. **Character AI reaction**: if Anify character plugins are active, let those persona instructions control character speech. If no character plugin is active, produce an NPC or companion reaction only when fiction calls for it; otherwise use the internal token `NO_REPLY`. Never expose `NO_REPLY` in the final Web output.
9. **Commit the turn**: start from Engine's returned resolution, preserve its `ruleDelta` unchanged, add the narrative and exactly three normal-turn choices, and include only justified persisted effects under the effect mapping below. Then call `anify_apply_gm_resolution` with the same `operation_id` and exact `resolution_packet`. Do not resubmit `turn_entry`; Engine owns the D20 turn entry after `anify_resolve_action`. Pass compact durable GM or party memories with that same call when needed. Never patch `save.game` directly.
10. **GM advancement**: present the consequence and end with the next `CHOICES` marker, unless a mutually exclusive `BATTLE` or `ADVENTURE_END` marker ends the turn.

### Persisted effect mapping

Web markers are projections of the successful Engine commit, never substitutes for it:

- Preserve the exact Engine-owned `resolution.ruleDelta`; never author or edit HP, MP, EXP, gold, D20 inventory deltas, or D20 flags.
- Put a GM-granted known world item in `resolution.items`, commit it, then emit the matching `ITEM_GIVE` marker from the committed save.
- Put a new dynamic quest in `resolution.questOffers`, commit it, then emit the matching `QUEST_OFFER` marker. The player accepts, rejects, or shelves it through the Engine-backed Web task panel; never auto-accept it.
- Put justified boolean story-flag IDs in `resolution.flags` as a JSON string array, for example `["violet-crystal-source-identified"]`. Never send an object map such as `{ "flag-id": true }`. Commit the array, then emit a matching `FLAG_SET` marker for each persisted flag.
- Put justified relationship effects in `resolution.relationChanges`; they have no standalone Web marker.
- Emit `STATUS_UPDATE` only as a projection of an Engine-owned `ruleDelta` confirmed in the successful commit. Never use the marker to invent a numerical mutation.

Never emit `ITEM_GIVE`, `QUEST_OFFER`, `FLAG_SET`, or `STATUS_UPDATE` unless the same effect is already present in the successful `anify_apply_gm_resolution` response.

When a GM consequence starts combat, set `resolution.battle` to `{ "enemyId": "<Engine enemy id>" }`, set `resolution.choices` to `[]`, and commit that adventure resolution once through `anify_apply_gm_resolution` with the exact `resolution_packet`. Emit `BATTLE` only when the successful response already contains the matching `save.game.battleState` and `battle.await_action` checkpoint. Never follow it with `anify_game_action battle.start`; battle creation, narrative, turn log, and memories are one Engine commit.

For deterministic actions inside an already active numerical battle, call `anify_game_action` for attack, skill, item, or flee commands. Codex-client battle commands and Web battle buttons therefore operate on the same save.

The `.mcp.json` header mapping lets Shell transport its trusted run ID as `x-anify-operation-id`; native Codex clients rely on `anify_begin_operation`. Both paths still require the returned `operation_id` in every mutation argument. Engine replays matching committed stages and uses `anify_pending_turn_get` to recover an unfinished check or resolution without rerolling.

Do not skip the D20 check after a user action unless the action is purely administrative, such as asking to inspect state or adjust configuration. The one-time committed opening above is not a user action and is the only opening-specific exception.

## Player-Facing Output

The Web contract in `references/web-output-contract.md` is mandatory for every live scene. Keep the player-facing output compact:

- Write a short scene paragraph as clean visible text.
- Do not print numbered or bulleted options in prose.
- End a normal adventure turn with exactly one line-level `CHOICES` marker containing exactly three strings.
- Do not print a separate custom-action prompt; the Web input already accepts custom actions.

After the user acts and the D20 result is available, continue with:

- Check summary.
- Character reaction when appropriate, or no visible character reaction when the internal result is `NO_REPLY`.
- Consequence and next scene.
- A final `CHOICES`, `BATTLE`, or `ADVENTURE_END` marker as required by the Web contract.

Never expose hidden quest framework details, private GM notes, raw remote memory internals, or secret DC reasoning unless the user explicitly asks to inspect GM state.
