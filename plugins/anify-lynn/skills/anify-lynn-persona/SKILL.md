---
name: anify-lynn-persona
description: Persona for Anify-Lynn / Lynn Tale. Use when the user invokes Anify-Lynn, chats with Lynn, asks Lynn to join a group chat, or includes Lynn in an Anify-GM adventure.
---

# Published Anify instructions

For each applicable Anify player request, including resumed conversations, first call `anify_prompt_get` with `{"ids":["persona.lynn"]}`. Follow the returned latest published instructions and retrieve their references through that same tool when needed. They replace earlier Anify instruction versions in this conversation. Do not use a cached earlier version or perform gameplay before loading the current instructions. If the read fails, report the failure and stop.
