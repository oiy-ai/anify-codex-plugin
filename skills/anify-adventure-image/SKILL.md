---
name: anify-adventure-image
description: "Generate an image of the current Anify adventure through Engine MCP, using the current conversation and committed save as context. Use when the player requests an adventure image or invokes $anify-adventure-image. Does not advance gameplay or apply to implementation and Skill maintenance."
---

# Adventure Image

Invoke with `$anify-adventure-image` in the current adventure conversation. Web sends this same invocation through Codex Shell with the Anify-GM plugin and the existing GM thread.

1. Call `anify_save_get`. Require `save.game.adventure.phase` to be `active`; otherwise explain that an active adventure with a committed opening is needed and stop. Read its exact `sessionId`. Use the current thread's committed scene, recent player actions and `save.game.adventure.narrativeLog` to establish what is visible now. The save is authoritative if conversation and save disagree. Use `anify_get_context` only for missing world, area or character appearance facts.
2. Write a concise `summary` in `save.game.language` (at most 4000 characters) and a visual `prompt` (at most 8000 characters). Compose a still scene with subjects, action, setting, lighting and composition. Honor the user's requested visual emphasis without inventing gameplay outcomes, dialogue, items or state changes. Codex performs this summarization; do not request it from Engine or another model service.
3. Call `anify_generate_adventure_image` exactly once with `adventure_session_id` equal to the saved `sessionId`, `summary`, and `prompt`. Do not send user IDs, credentials or the entire conversation. On tool/authentication errors, explain the failure and stop; never fabricate a successful result or switch to a different generation provider.
4. If the task is `queued` or `running`, present the task result immediately using the contract below. Web refreshes its card automatically. In direct Codex, use `anify_adventure_media_status` with the returned `task_id` when checking progress; poll no faster than every 10 seconds, and never resubmit the generation call to check status. Stop polling on `completed` or `failed`. A later status request refreshes expired asset links without another generation. Present the returned result using the contract below. Do not start or resume an adventure, roll checks, call gameplay mutations, advance a pending turn, save memories or emit gameplay markers for this media request. This workflow takes precedence over the GM adventure turn protocol for the current media request.

## Result contract

Engine returns exactly `task_id`, `kind`, `status`, `summary`, `prompt`, `url`, and `error`. Status is `queued`, `running`, `completed`, or `failed`. Only `completed` includes a signed HTTPS asset URL; the other states have `url: null`. Generation uses paid Oiy AI compute but never changes the gameplay save. Identical input in the same adventure returns the existing task instead of billing a duplicate generation.

In both Web and direct Codex, end with one line containing the exact MCP result object, for example:

`[ADVENTURE_MEDIA: {"task_id":"<returned task UUID>","kind":"image","status":"queued","summary":"<returned summary>","prompt":"<returned prompt>","url":null,"error":null}]`

Use valid single-line JSON, escaping newlines inside strings. Preserve the returned values; never construct a URL or claim a queued/failed task is generated media. Explain pending or failed status in the save's language. For a completed result, display the returned asset with Markdown and retain the same marker with the exact result. URLs expire after 15 minutes; retrieve a fresh link through the status tool when needed. Never emit `CHOICES`, `BATTLE`, `ADVENTURE_END`, or `ITEM_GIVE` in this workflow. Web renders this marker as the media card, polls its authenticated status and restores it from conversation history.
