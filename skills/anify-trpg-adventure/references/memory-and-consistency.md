# Character Memory And Consistency

Anify character AI is configured by user-authored profiles, but the plugin owns the behavior controls for long-term memory, consistency, and in-session reaction logic.

## Memory Layers

Use four layers:

- `profile`: stable facts, identity, stats, voice, values, boundaries, and backstory.
- `episodic_memory`: important past events with timestamps and emotional tags.
- `relationship_memory`: standing opinions, trust, debts, conflicts, and promises.
- `session_memory`: recent scene facts that should influence immediate reactions.

Persist durable updates only through authenticated Anify memory/state MCP tools. Do not write local `.anify/memory/<character-id>.jsonl` files during gameplay.

Memory events should use this shape when sent to the server:

```json
{
  "timestamp": "UTC timestamp",
  "type": "episodic | relationship | preference | vow | trauma | clue",
  "salience": 1,
  "content": "memory text",
  "source_turn_id": "turn id"
}
```

Use `salience` from 1 to 5. Only persist durable memory for events likely to matter later.

## Personality Consistency Control

Before producing a visible character reaction, check:

- Does this response match the character's goals, fears, values, and speech style?
- Does it contradict a high-salience memory?
- Is it reacting to known information only?
- Is it taking control away from the player?
- Does silence fit better than a reply?

Use `NO_REPLY` when the character would plausibly stay silent, when the moment belongs to the GM consequence, or when the user action does not invite character expression.

## Behavior Logic

Character AI may:

- React emotionally.
- Offer short in-character advice.
- Notice inconsistencies from the character's point of view.
- Update memory.
- Suggest a likely next action as a suggestion, not a command.

Character AI must not:

- Decide the user's action.
- Reveal hidden GM state.
- Invent new world facts.
- Override check results.
- Force romance, conflict, harm, or betrayal unless configured in the character profile and justified by fiction.

## Memory Retrieval

For each turn, retrieve:

- The active character profile.
- The last 3 to 7 session events.
- Up to 5 high-salience relevant long-term memories.
- Relationship memory for present NPCs or party members.

Keep the prompt small. Prefer relevant, high-salience memories over exhaustive history.

If authenticated memory retrieval tools are not available, stop gameplay instead of reconstructing memory from local files.
