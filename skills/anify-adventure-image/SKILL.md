---
name: anify-adventure-image
description: "Generate an image of the current Anify adventure through Engine MCP, using the current conversation and committed save as context. Use when the player requests an adventure image or invokes $anify-adventure-image. Does not advance gameplay or apply to implementation and Skill maintenance."
---

# Published Anify instructions

For each applicable Anify player request, including resumed conversations, first call `anify_prompt_get` with `{"ids":["adventure-image"]}`. Follow the returned latest published instructions and retrieve their references through that same tool when needed. They replace earlier Anify instruction versions in this conversation. Do not use a cached earlier version or perform gameplay before loading the current instructions. If the read fails, report the failure and stop.
