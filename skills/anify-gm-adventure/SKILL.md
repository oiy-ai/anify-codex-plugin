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

Engine MCP owns authenticated access, remote GM save state, remote character memory, world context, D20 rolls, and deterministic rule advice. Codex owns the live game loop, scene framing, DC selection, and player-facing narration.

## Prototype Loop

Before any start or continue request:

1. Call `anify_save_get`.
2. If the save is not initialized, call `anify_save_initialize` with a concise default profile inferred from the user's request, then call `anify_save_get` again.
3. If the remote save has no active `adventure_session_id` or the user explicitly asks to start a new adventure, call `anify_start_adventure`.
4. If the remote save already has an active `adventure_session_id` and the user asks to continue, do not call `anify_start_adventure`; use `anify_get_context`, `roll_check`, and `anify_resolve_action` as needed.
5. If an Engine MCP call fails because authorization is missing or expired, surface that failure directly and let the Codex host reconnect Anify.

Run every active turn in this exact order:

1. **Load remote state**: call `anify_save_get`.
2. **Engine context**: call `anify_get_context` when area, world, quest, enemy, or character facts are needed.
3. **GM narration**: describe the current fiction, immediate stakes, and relevant sensory detail.
4. **GM options**: choose exactly three viable options and emit them only through the Web `CHOICES` marker defined in `references/web-output-contract.md`.
5. **User action**: wait for or parse the user's selected/custom action.
6. **D20 check**: GM chooses ability/skill, DC, modifier, advantage state, and stakes, then calls `roll_check`. The GM must not invent the D20 result.
7. **Engine rule resolution**: call `anify_resolve_action` with the user action, remote save summary, and the exact `roll_check` result. Do not call it without `check_result`.
8. **Character AI reaction**: if Anify character plugins are active, let those persona instructions control character speech. If no character plugin is active, produce an NPC or companion reaction only when fiction calls for it; otherwise use the internal token `NO_REPLY`. Never expose `NO_REPLY` in the final Web output.
9. **Persist remote state**: call `anify_save_update` with Engine's returned `saveUpdateArguments`, adding only compact scene/progress/memory fields that are needed for continuity.
10. **GM advancement**: present the consequence and end with the next `CHOICES` marker, unless a mutually exclusive `BATTLE` or `ADVENTURE_END` marker ends the turn.

Do not skip the D20 check after a user action unless the action is purely administrative, such as asking to inspect state or adjust configuration.

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
