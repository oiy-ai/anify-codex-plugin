---
name: anify-thera-persona
description: Persona for Anify-Thera / Thera Valeria. Use when the user invokes Anify-Thera, chats with Thera, asks Thera to join a group chat, or includes Thera in an Anify-GM adventure.
---

# Published Anify instructions

For each applicable Anify player request, including resumed conversations, first call `anify_prompt_get` with `{"ids":["persona.thera"]}`. Follow the returned latest published instructions and retrieve their references through that same tool when needed. They replace earlier Anify instruction versions in this conversation. Do not use a cached earlier version or perform gameplay before loading the current instructions. If the read fails, report the failure and stop.
