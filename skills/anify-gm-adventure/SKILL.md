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

## Prototype Loop

Before any start or continue request:

1. Call `anify_save_get`.
2. If the save is not initialized, call `anify_save_initialize` with a concise default profile inferred from the user's request, then call `anify_save_get` again.
3. Read active adventure state from `save.adventure` and canonical gameplay state from `save.game`.
4. If `save.adventure` is null or the user explicitly asks to start a new adventure, call `anify_start_adventure` with `session_intent: "new"`. Pass the active character-plugin party, with at most two character IDs. When no explicit party selection exists, use the world-declared default `lynn_tale` and `lyra_oravia`. A Shell new-session request must use a new host-provided logical GM thread ID; pass it as `gm_thread_id`, otherwise omit it and never fabricate one.
5. If `save.adventure` is active and the user asks to continue, call `anify_start_adventure` once with `session_intent: "resume"`. Do not override its fixed world, area, language, party, or GM thread. Continue only when Engine returns the same active session.

When `save.adventure.opening_pending` is true, the current response is the one-time opening turn. Build the opening narration and exactly three choices, then call `anify_apply_gm_resolution` directly with an `adventure` resolution using the current `save.game.resumeCheckpoint.revision`. Include a compact opening `turn_entry` and omit `resolution_packet`. Do not roll a D20 and do not call `anify_resolve_action` for this opening-only turn. Emit the same committed narration and choices through the Web output contract only after the Engine commit succeeds. This successful commit is what clears `opening_pending`; never return an uncommitted opening.
6. If an Engine MCP call fails because authorization is missing or expired, surface that failure directly and let the Codex host reconnect Anify.

Run every active turn in this exact order:

1. **Load canonical state**: call `anify_save_get` and treat `save.game` as the only gameplay state.
2. **Engine context**: call `anify_get_context` when area, world, quest, enemy, or character facts are needed.
3. **GM narration**: describe the current fiction, immediate stakes, and relevant sensory detail.
4. **GM options**: choose exactly three viable options and emit them only through the Web `CHOICES` marker defined in `references/web-output-contract.md`.
5. **User action**: wait for or parse the user's selected/custom action.
6. **D20 check**: GM chooses ability/skill, DC, modifier, advantage state, and stakes, then calls `roll_check`. The GM must not invent the D20 result.
7. **Engine rule resolution**: call `anify_resolve_action` with the user action and exact full `roll_check` result. Preserve its returned `resolution_packet` without changing any field. Do not submit a client-authored save or call it without `check_result`.
8. **Character AI reaction**: if Anify character plugins are active, let those persona instructions control character speech. If no character plugin is active, produce an NPC or companion reaction only when fiction calls for it; otherwise use the internal token `NO_REPLY`. Never expose `NO_REPLY` in the final Web output.
9. **Commit the turn**: extend only the presentation fields of Engine's returned resolution—narrative, exactly three normal-turn choices, and justified marker effects—then call `anify_apply_gm_resolution` with the exact `resolution_packet`. Do not resubmit `turn_entry`; Engine owns the D20 turn entry after `anify_resolve_action`. Pass compact durable GM or party memories with that same call when needed. Never patch `save.game` directly.
10. **GM advancement**: present the consequence and end with the next `CHOICES` marker, unless a mutually exclusive `BATTLE` or `ADVENTURE_END` marker ends the turn.

When a GM consequence starts combat, set `resolution.battle` to `{ "enemyId": "<Engine enemy id>" }`, set `resolution.choices` to `[]`, and commit that adventure resolution once through `anify_apply_gm_resolution` with the exact `resolution_packet`. Emit `BATTLE` only when the successful response already contains the matching `save.game.battleState` and `battle.await_action` checkpoint. Never follow it with `anify_game_action battle.start`; battle creation, narrative, turn log, and memories are one Engine commit.

For deterministic actions inside an already active numerical battle, call `anify_game_action` for attack, skill, item, or flee commands. Codex-client battle commands and Web battle buttons therefore operate on the same save.

The host transports a stable per-run operation ID through `.mcp.json` as `x-anify-operation-id`. Never add an operation ID to tool arguments and never fabricate or rotate it inside a turn. `roll_check`, `anify_resolve_action`, and `anify_apply_gm_resolution` share that automatic header; Engine replays their committed receipts after an interrupted run and rejects same-stage input changes.

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
