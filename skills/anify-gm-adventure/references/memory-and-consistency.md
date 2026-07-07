# GM Memory And Consistency

Anify-GM owns GM progress and party-facing continuity. Installed Anify character plugins own their own persona memory and private/full-context history.

## Memory Files

All first-version durable memory lives under:

```text
CODEX_HOME/anify/userA/GM
```

Use:

- `profile.md`: stable facts, identity, stats, voice, values, boundaries, and backstory.
- `progress.md`: durable cross-adventure progress, completed outcomes, unresolved hooks, and next-adventure seeds.
- `gm-memory.md`: GM-only campaign continuity, hidden clocks, unresolved hooks, and world-state notes.
- `party-memory.md`: party-facing episodic and relationship memory known in the current adventure.
- `turn-log.md`: append-only visible session chronology.

Do not write `.anify` memory files. Do not use `CODEX_HOME/anify/users/userA`. Do not invent a second save root.

## Memory Update Rules

Update Markdown after each resolved player action:

- Append a concise turn entry to `turn-log.md`.
- Update `save.md` with current location, stats, inventory, flags, active quests, and scene summary.
- Add only durable GM facts to `gm-memory.md`.
- Add only party-known durable memories to `party-memory.md`.
- Update `progress.md` when an adventure ends or a durable cross-adventure fact changes.

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
- The durable adventure record from `progress.md`.
- The current save summary from `save.md`.
- The last 3 to 7 turn-log entries.
- Up to 5 relevant durable notes from `gm-memory.md` and `party-memory.md`.

Keep the prompt small. Prefer relevant, high-salience memories over exhaustive history.
