---
name: anify-trpg-adventure
description: Run an AI-driven DnD-style TRPG adventure with a GM AI, configurable character AI, stable turn-packet orchestration, long-term memory, personality consistency control, and mandatory D20 checks through the Anify D20 MCP tool.
---

# Anify TRPG Adventure

Use this skill when the user wants to start, continue, configure, or run an AI-driven TRPG, DnD-style adventure, campaign, party scene, GM session, or character AI roleplay.

## Required References

Before running or modifying an Anify session, read:

- `references/orchestration.md`
- `references/d20-mcp-contract.md`
- `references/memory-and-consistency.md`

When creating a new campaign or character profile, also use:

- `templates/campaign-template.json`
- `templates/character-template.json`

## Operating Model

Anify has two independent AI roles coupled by stable packets:

- **GM AI** owns the world, rules interpretation, NPCs, pacing, hidden quest framework, scene framing, D20 check request, consequences, and campaign state.
- **Character AI** owns player-character voice, internal continuity, memories, personality consistency, emotional reaction, and behavior suggestions. It must not override GM world facts or check outcomes.

Keep these roles logically separate even when one Codex assistant is executing both phases. Iterate them separately through the packet contracts in `references/orchestration.md`.

## Prototype Loop

Run every active turn in this exact order:

1. **GM narration**: describe the current fiction, immediate stakes, and relevant sensory detail.
2. **GM options**: provide exactly three viable options. Also state that the user may choose another action.
3. **User action**: wait for or parse the user's selected/custom action.
4. **D20 check**: GM chooses ability/skill, DC, modifier, advantage state, and stakes, then calls the Anify D20 MCP tool. The GM must not invent the D20 result.
5. **Character AI reaction**: produce an in-character reaction or the exact token `NO_REPLY` if the character would not respond.
6. **GM advancement**: use the D20 result and optional character reaction to update the scene, world state, memory, and next choices.

Do not skip the D20 check after a user action unless the action is purely administrative, such as asking to save, inspect state, or adjust configuration.

## State Files

Persist campaign data under the active workspace unless the user asks for another location:

- `.anify/campaign-state.json`
- `.anify/session-log.md`
- `.anify/characters/<character-id>.json`
- `.anify/memory/<character-id>.jsonl`

If these files do not exist, offer to create them from the templates. If the user wants to start immediately, create a minimal default campaign and a placeholder character, then continue.

## D20 Tool Requirement

Use the MCP server named `anify-d20` and its `roll_check` tool when available. If the tool is not exposed yet, search available tools for `anify d20 roll_check`. If no D20 MCP tool is available, stop the session and tell the user that Anify needs the D20 MCP server connected before checks can be resolved.

The GM may hide raw roll details in narration when `secret` is true, but the persisted state must keep the structured result.

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

Never expose hidden quest framework details, private GM notes, or secret DC reasoning unless the user explicitly asks to inspect GM state.
