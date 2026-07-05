---
name: anify-trpg-adventure
description: Run a Firebase-authenticated AI-driven DnD-style TRPG adventure with Engine MCP rule tools, local Markdown save state, GM memory, character memory, and mandatory MCP-gated D20 checks.
---

# Anify TRPG Adventure

Use this skill when the user wants to start, continue, configure, or run an AI-driven TRPG, DnD-style adventure, campaign, party scene, GM session, or character AI roleplay.

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
- `templates/userA-save.md`
- `templates/userA-gm-memory.md`
- `templates/userA-character-memory.md`
- `templates/userA-turn-log.md`

## Operating Model

Anify uses Codex as the game loop and local Markdown files as the first development save authority.

The active user path is:

```text
CODEX_HOME/anify/users/userA
```

Required local files:

- `profile.md`
- `save.md`
- `gm-memory.md`
- `character-memory.md`
- `turn-log.md`

If any required file is missing, create it from the matching `templates/userA-*.md` file before gameplay. Do not use `.anify` or any other ad hoc save path.

Engine MCP is the deterministic rule service. It owns authenticated access, world context, D20 rolls, and rule advice. Codex owns narrative continuity, local save text, GM memory, and character memory.

## Prototype Loop

Before the prototype loop starts:

1. Read `profile.md`, `save.md`, `gm-memory.md`, `character-memory.md`, and the last relevant entries of `turn-log.md`.
2. Call `anify_auth_status`.
3. If the MCP server is not authenticated, stop immediately and let the Codex host reconnect the Anify MCP server.
4. Call `anify_start_adventure` with no arguments unless the user explicitly supplied a world or language.
5. Continue only if `anify_start_adventure` returns `readyForGameplay: true`.

Run every active turn in this exact order:

1. **Load local state**: reread the local Markdown files.
2. **Engine context**: call `anify_get_context` when area, world, quest, enemy, or character facts are needed.
3. **GM narration**: describe the current fiction, immediate stakes, and relevant sensory detail.
4. **GM options**: provide exactly three viable options. Also state that the user may choose another action.
5. **User action**: wait for or parse the user's selected/custom action.
6. **D20 check**: GM chooses ability/skill, DC, modifier, advantage state, and stakes, then calls `roll_check`. The GM must not invent the D20 result.
7. **Engine rule resolution**: call `anify_resolve_action` with the user action, local save summary, and check result.
8. **Character AI reaction**: produce an in-character reaction or the exact token `NO_REPLY` if the character would not respond.
9. **Persist Markdown**: update `save.md`, `gm-memory.md`, `character-memory.md`, and append `turn-log.md` using the check result and Engine rule advice.
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
