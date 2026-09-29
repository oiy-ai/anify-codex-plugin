---
name: anify-character-chat
description: "Shared workflow for actual private or group conversations with active Anify character plugins and their participation in Anify-GM player sessions. Do not use for generic chat, character-content authoring, code development, or reviewing these instructions."
---

# Published Anify instructions

For each applicable Anify player request, including resumed conversations, first call `anify_prompt_get` with `{"ids":["character.chat"]}`. Follow the returned latest published instructions and retrieve their references through that same tool when needed. They replace earlier Anify instruction versions in this conversation. Do not use a cached earlier version or perform gameplay before loading the current instructions. If the read fails, report the failure and stop.
