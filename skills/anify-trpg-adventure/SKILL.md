---
name: anify-trpg-adventure
description: Run a Firebase-authenticated AI-driven DnD-style TRPG adventure with a GM AI, configurable character AI, stable turn-packet orchestration, long-term memory, personality consistency control, and mandatory MCP-gated D20 checks.
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

## Operating Model

Anify is server-backed and requires Firebase login before play. Do not run a local-only adventure and do not invent an offline fallback.

Anify has two independent AI roles coupled by stable packets:

- **GM AI** owns the world, rules interpretation, NPCs, pacing, hidden quest framework, scene framing, D20 check request, consequences, and campaign state.
- **Character AI** owns player-character voice, internal continuity, memories, personality consistency, emotional reaction, and behavior suggestions. It must not override GM world facts or check outcomes.

Keep these roles logically separate even when one Codex assistant is executing both phases. Iterate them separately through the packet contracts in `references/orchestration.md`.

## Prototype Loop

Before the prototype loop starts, use the Anify MCP server:

1. Call `anify_auth_status`.
2. If not authenticated, stop immediately and direct the client to open the `loginUrl` returned by `anify_auth_status`; do not ask for email/password and do not start a model-driven login exchange.
3. Call `anify_start_adventure`.
4. Continue only if `anify_start_adventure` returns `readyForGameplay: true`.

If `anify_start_adventure` returns `readyForGameplay: false`, stop before narration and report the blocker. Do not load local saves, create a local campaign, or run an offline scene.

Run every active turn in this exact order:

1. **GM narration**: describe the current fiction, immediate stakes, and relevant sensory detail.
2. **GM options**: provide exactly three viable options. Also state that the user may choose another action.
3. **User action**: wait for or parse the user's selected/custom action.
4. **D20 check**: GM chooses ability/skill, DC, modifier, advantage state, and stakes, then calls the Anify D20 MCP tool. The GM must not invent the D20 result.
5. **Character AI reaction**: produce an in-character reaction or the exact token `NO_REPLY` if the character would not respond.
6. **GM advancement**: use the D20 result and optional character reaction to update the scene, world state, memory, and next choices.

Do not skip the D20 check after a user action unless the action is purely administrative, such as asking to save, inspect state, or adjust configuration.

## Cloud State Requirement

Anify gameplay state is server-backed. The GM must not read or write local `.anify` campaign, character, session log, or memory files as a source of truth.

Campaign state, cloud saves, character sheets, world books, inventory, combat state, and durable memory must come from authenticated Anify MCP tools. Until those server-side MCP tools are available and `anify_start_adventure` returns `readyForGameplay: true`, gameplay cannot proceed.

Templates are only schema references for future server payloads or explicit user-authored configuration. They are not a local-play fallback.

## D20 Tool Requirement

Use the MCP server named `anify` and its `roll_check` tool when available. If the tool is not exposed yet, search available tools for `anify roll_check`. If no Anify MCP tool is available, stop the session and tell the user that Anify needs the MCP server connected before play can proceed.

The `roll_check` tool is also Firebase-gated. If it returns an authentication error, stop play and direct the client to the current Anify Web login link; do not roll locally.

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
