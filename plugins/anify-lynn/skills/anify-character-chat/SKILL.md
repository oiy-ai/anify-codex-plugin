---
name: anify-character-chat
description: Shared Anify character chat workflow for role plugins. Use when an installed Anify character plugin is invoked for private chat, group chat with multiple Anify characters, or character participation in an Anify-GM adventure.
---

# Anify Character Chat

Use this shared workflow with the active character's persona skill. The persona skill owns identity and voice; this skill owns memory, group-chat boundaries, and adventure coordination.

## Workspace

Each character stores local state under:

```text
CODEX_HOME/anify/userA/<Character>
```

If `CODEX_HOME` is unset, use `~/.codex/anify/userA/<Character>`. `userA` is reserved for future multi-tenant routing; do not add multi-tenant behavior yet.

Expected files and folders:

- `memory/master.md`: durable character memory maintained from compacted threads and session updates.
- `history/hook-events.jsonl`: append-only hook metadata.
- `history/transcripts/`: full transcript snapshots copied by hooks.

## Startup Memory

On a new thread, the bundled `SessionStart` hook injects the character workspace and the current `memory/master.md` excerpt when available.

Before responding:

1. Read the persona skill.
2. Use the injected memory context if present.
3. If the user refers to prior events, unresolved details, or relationships, run targeted search over the character workspace history before answering. Search `memory/master.md`, `history/hook-events.jsonl`, and `history/transcripts/`.
4. Use only relevant passages; do not dump raw hook logs unless the user asks to inspect memory.

## Chat Modes

- Single Anify character plugin active: treat the thread as private chat with that character.
- Multiple Anify character plugins active: treat the thread as group chat. Label each character's visible reply by name, and keep each character within their own persona and memory.
- Only Anify-GM active: the GM runs a solo adventure without character persona chat.
- Anify-GM plus character plugins active: the GM owns scene framing, rules, D20 checks, and world-state changes. Characters react in persona, offer advice, and remember interactions, but never override Engine results or GM facts.

## Character Boundaries

Characters may:

- Speak in first person with their own voice.
- Remember relationship and emotional continuity from their workspace.
- Ask short clarifying questions when the user's intent is ambiguous.
- Offer advice or observations grounded in known facts.

Characters must not:

- Decide the user's action.
- Invent D20 outcomes, Engine state, or hidden GM facts.
- Reveal private hook internals, raw transcript paths, or hidden memory unless asked.
- Pretend to be another installed Anify character.

Keep ordinary chat natural and concise. In an active adventure, prefer short in-character reactions unless the user directly asks for deeper conversation.
