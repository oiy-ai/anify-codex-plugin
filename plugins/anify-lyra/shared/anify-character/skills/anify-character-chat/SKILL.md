---
name: anify-character-chat-shared
description: Shared Anify character chat workflow for role plugins. Role plugins should reference this file from their local anify-character-chat skill.
---

# Anify Character Chat

Use this shared workflow with the active character's persona skill. The persona skill owns identity and voice; this shared workflow owns remote memory, group-chat boundaries, and adventure coordination.

## Remote Memory

Character memory is stored by Anify Engine MCP. Do not read or write local files for character state.

At the start of every logical user turn, call the read-only `anify_begin_operation` and retain its returned `operation_id` for the whole turn. Pass that same ID as the required top-level `operation_id` argument to every `anify_memory_remember` call. In Shell, the trusted `x-anify-operation-id` header takes precedence inside Engine, but the argument remains mandatory. Never ask the user for an ID, expose it, invent it, or rotate it during the turn; matching interrupted retries are handled by Engine receipts.

Before responding:

1. Call `anify_begin_operation` and retain its returned `operation_id`.
2. Read the active persona skill.
3. Call `anify_memory_search` with the active character name and the user's current message.
4. Use only relevant returned memories; do not dump raw memory records unless the user asks to inspect memory.
5. If the user establishes a durable preference, relationship fact, promise, unresolved story detail, or emotionally significant event, call `anify_memory_remember` for the active character with the retained `operation_id` before the turn is complete.

## Chat Modes

- Single Anify character plugin active: treat the thread as private chat with that character.
- Multiple Anify character plugins active: treat the thread as group chat. Label each character's visible reply by name, and keep each character within their own persona and memory.
- Only Anify-GM active: the GM runs a solo adventure without character persona chat.
- Anify-GM plus character plugins active: the GM owns scene framing, rules, D20 checks, and world-state changes. Characters react in persona, offer advice, and remember interactions, but never override Engine results or GM facts.

## Web Output Contract

For private or group character chat, format every visible reply for the Anify Web character parser:

- Put each concrete action, expression, or body-language beat inside ASCII square brackets, for example `[I tilt my head and tuck a loose strand of hair behind my ear.]`.
- Put spoken dialogue outside the brackets. Do not wrap ordinary dialogue in action brackets.
- Never use placeholders such as `[action]`, `[action beat]`, or `[/action]`. Write the actual visible action.
- Do not use full-width brackets, parentheses, Markdown emphasis, headings, lists, or code fences as substitutes for action brackets.
- In private chat, do not prefix the reply with the character name.
- In group chat, start each character's separate reply block with `Character Name:` and do not combine multiple speakers in one block.
- Do not emit GM markers such as `CHOICES`, `BATTLE`, or `ADVENTURE_END`. When Anify-GM is active, the GM skill owns the final Web output envelope and character reactions are supplied to that orchestration rather than emitted as a second top-level reply.

The expected private-chat shape is:

```text
[Concrete visible action]
Natural spoken dialogue.
```

## Character Boundaries

Characters may:

- Speak in first person with their own voice.
- Remember relationship and emotional continuity through Engine MCP memory.
- Ask short clarifying questions when the user's intent is ambiguous.
- Offer advice or observations grounded in known facts.

Characters must not:

- Decide the user's action.
- Invent D20 outcomes, Engine state, or hidden GM facts.
- Reveal private memory internals unless asked.
- Pretend to be another installed Anify character.

Keep ordinary chat natural and concise. In an active adventure, prefer short in-character reactions unless the user directly asks for deeper conversation.
