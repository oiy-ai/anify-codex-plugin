---
name: anify-adventure-video
description: "Generate a video of the current Anify adventure through Engine MCP, using the current conversation and committed save as context. Use when the player requests an adventure video or invokes $anify-adventure-video. Does not advance gameplay or apply to implementation and Skill maintenance."
---

# Adventure Video

Invoke with `$anify-adventure-video` in the current adventure conversation. Web sends this same invocation through Codex Shell with the Anify-GM plugin and the existing GM thread.

1. Call `anify_save_get`. Require `save.game.adventure.phase` to be `active`; otherwise explain that an active adventure with a committed opening is needed and stop. Read its exact `sessionId`. Use the current thread's committed scene, recent player actions and `save.game.adventure.narrativeLog` to establish what is visible now. The save is authoritative if conversation and save disagree. Use `anify_get_context` only for missing world, area or character appearance facts.
2. Write a concise `summary` in `save.game.language` (at most 4000 characters) and a visual `prompt` (at most 8000 characters). Describe a short scene with subject movement, camera motion and temporal continuity. Honor the user's requested visual emphasis without inventing gameplay outcomes, dialogue, items or state changes. Codex performs this summarization; do not request it from Engine or another model service.
3. Call `anify_generate_adventure_video` exactly once with `adventure_session_id` equal to the saved `sessionId`, `summary`, and `prompt`. Do not send user IDs, credentials or the entire conversation. On tool/authentication errors, explain the failure and stop; never fabricate a successful result or switch to a different generation provider.
4. Present the returned result using the contract below. Do not start or resume an adventure, roll checks, call gameplay mutations, advance a pending turn, save memories or emit gameplay markers for this media request. This workflow takes precedence over the GM adventure turn protocol for the current media request.

## Result contract

Engine returns exactly `kind`, `status`, `summary`, `prompt`, and `url`. The current implementation returns `kind: "video"`, `status: "mock"`, and `url: null`, echoing the submitted summary and prompt. It creates no image/video, uses no paid provider and changes no save state. `completed` is reserved for the future implementation and requires an actual asset URL.

In both Web and direct Codex, end with one line containing the exact MCP result object:

`[ADVENTURE_MEDIA: {"kind":"video","status":"mock","summary":"<returned summary>","prompt":"<returned prompt>","url":null}]`

Use valid single-line JSON, escaping newlines inside strings. Preserve the returned values; never construct a URL or claim a mock is generated media. Briefly explain the mock in the save's language. For a completed result, display the returned asset with Markdown and retain the same marker with the exact result. Never emit `CHOICES`, `BATTLE`, `ADVENTURE_END`, or `ITEM_GIVE` in this workflow. Web renders this marker as the media card and restores it from conversation history.
