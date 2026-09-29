---
name: anify-gm-adventure
description: "Run actual Anify player sessions and Engine-backed gameplay commands in Web or Codex. Use when the user explicitly invokes Anify-GM to play or requests an action on their current game save. Do not use for code development, protocol review, Skill editing, authored lore, or developer save debugging unless the user explicitly requests a player gameplay operation."
---

# Published Anify instructions

For each applicable Anify player request, including resumed conversations, first call `anify_prompt_get` with `{"ids":["gm-adventure"]}`. Follow the returned latest published instructions and retrieve their references through that same tool when needed. They replace earlier Anify instruction versions in this conversation. Do not use a cached earlier version or perform gameplay before loading the current instructions. If the read fails, report the failure and stop.
