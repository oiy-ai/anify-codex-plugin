---
name: anify-gm-adventure
description: Run Anify-GM adventures with Engine MCP auth, world context, rule advice, mandatory D20 checks, and local Markdown progress saves under CODEX_HOME/anify/userA/GM. Use when the user invokes Anify-GM, starts or continues a solo adventure, or runs an adventure with installed Anify character plugins.
---

# Anify GM Adventure

Use this skill when the user wants to start, continue, configure, or run an AI-driven Anify TRPG adventure, DnD-style campaign, party scene, GM session, or adventure with installed Anify character plugins.

## Required References

Before running or modifying an Anify session, read:

- `references/authentication.md`
- `references/orchestration.md`
- `references/d20-mcp-contract.md`
- `references/memory-and-consistency.md`

When creating a new campaign or character profile, also use:

- `templates/campaign-template.json`
- `templates/character-template.json`
- `templates/userA-profile.md`
- `templates/userA-progress.md`
- `templates/userA-save.md`
- `templates/userA-gm-memory.md`
- `templates/userA-party-memory.md`
- `templates/userA-turn-log.md`

## Operating Model

Anify uses Codex as the game loop and local Markdown files as the first development save authority.

The active user path is:

```text
CODEX_HOME/anify/userA/GM
```

Required local files:

- `profile.md`
- `progress.md`
- `save.md`
- `gm-memory.md`
- `party-memory.md`
- `turn-log.md`

If `CODEX_HOME` is unset, use `~/.codex/anify/userA/GM`. If any required file is missing, create it from the matching `templates/userA-*.md` file before gameplay. Do not use `.anify`, `CODEX_HOME/anify/users/userA`, or any other ad hoc save path.

Engine MCP is the deterministic rule service. It owns authenticated access, world context, D20 rolls, and rule advice. Codex owns narrative continuity, local progress/save text, GM memory, and party-facing memory.

## Prototype Loop

Before any start or continue request:

1. Read `profile.md`, `progress.md`, `save.md`, `gm-memory.md`, `party-memory.md`, and the last relevant entries of `turn-log.md`.
2. Call `anify_auth_status`.
3. If the MCP server is not authenticated, stop immediately and let the Codex host reconnect the Anify MCP server.
4. If `save.md` has no `Adventure session` or the user explicitly asks to start a new adventure, use `progress.md` to seed continuity and call `anify_start_adventure` with no arguments unless the user supplied a world or language.
5. If `save.md` already has an `Adventure session` and the user asks to continue, do not call `anify_start_adventure`; preserve the saved session and use `anify_get_context`, `roll_check`, and `anify_resolve_action` as needed.
6. Continue only if the new start returned `readyForGameplay: true`, or the existing save already records `Engine ready for gameplay: true`.

At adventure end, update `progress.md` with the durable outcome, unresolved hooks, relationships, inventory changes, and next-adventure seed. Then clear or archive only transient scene details in `save.md` if the current adventure is complete.

Run every active turn in this exact order:

1. **Load local state**: reread the local Markdown files.
2. **Engine context**: call `anify_get_context` when area, world, quest, enemy, or character facts are needed. Do not use `anify_start_adventure` as a context refresh for continued turns.
3. **GM narration**: describe the current fiction, immediate stakes, and relevant sensory detail.
4. **GM options**: provide exactly three viable options. Also state that the user may choose another action.
5. **User action**: wait for or parse the user's selected/custom action.
6. **D20 check**: GM chooses ability/skill, DC, modifier, advantage state, and stakes, then calls `roll_check`. The GM must not invent the D20 result.
7. **Engine rule resolution**: call `anify_resolve_action` with the user action, local save summary, and check result.
8. **Character AI reaction**: if Anify character plugins are active, let those persona instructions control character speech. If no character plugin is active, produce an NPC or companion reaction only when fiction calls for it; otherwise use the exact token `NO_REPLY`.
9. **Persist Markdown**: update `save.md`, `gm-memory.md`, `party-memory.md`, and append `turn-log.md` using the check result and Engine rule advice. Update `progress.md` only for durable cross-adventure changes or adventure-end summaries.
10. **GM advancement**: present the consequence and next three options.

Do not skip the D20 check after a user action unless the action is purely administrative, such as asking to inspect state or adjust configuration.

## Output Style

When running a live scene, keep the player-facing output compact:

- A short scene paragraph.
- Exactly three numbered options.
- A line saying custom actions are allowed.

After the user acts and the D20 result is available, continue with:

- Check summary.
- Character reaction or no visible character reaction.
- Consequence and next scene.
- Three new options.

Never expose hidden quest framework details, private GM notes, raw local memory internals, or secret DC reasoning unless the user explicitly asks to inspect GM state.
