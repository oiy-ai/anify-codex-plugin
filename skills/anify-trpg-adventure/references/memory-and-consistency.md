# Character Memory And Consistency

Anify character AI is configured by user-authored profiles, while the plugin owns behavior controls for local long-term memory, consistency, and in-session reaction logic.

## Memory Files

All first-version durable memory lives under:

```text
CODEX_HOME/anify/users/userA
```

Use:

- `profile.md`: stable facts, identity, stats, voice, values, boundaries, and backstory.
- `gm-memory.md`: GM-only campaign continuity, hidden clocks, unresolved hooks, and world-state notes.
- `character-memory.md`: character-facing episodic and relationship memory.
- `turn-log.md`: append-only visible session chronology.

Do not write `.anify` memory files. Do not invent a second save root.

## Memory Update Rules

Update Markdown after each resolved player action:

- Append a concise turn entry to `turn-log.md`.
- Update `save.md` with current location, stats, inventory, flags, active quests, and scene summary.
- Add only durable GM facts to `gm-memory.md`.
- Add only character-known durable memories to `character-memory.md`.

Keep updates compact and timestamped. Prefer facts that will matter later over exhaustive narration.

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

- The active profile from `profile.md`.
- The current save summary from `save.md`.
- The last 3 to 7 turn-log entries.
- Up to 5 relevant durable notes from `gm-memory.md` and `character-memory.md`.

Keep the prompt small. Prefer relevant, high-salience memories over exhaustive history.
