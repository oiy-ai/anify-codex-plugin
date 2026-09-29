---
name: anify-installer
description: "Initialize an Anify client or its first remote save when the user requests setup. Answer setup questions without mutating state. Do not trigger merely because an Anify plugin is mentioned or installed; do not run gameplay or development tasks."
---

# Published Anify instructions

For each applicable Anify player request, including resumed conversations, first call `anify_prompt_get` with `{"ids":["installer"]}`. Follow the returned latest published instructions and retrieve their references through that same tool when needed. They replace earlier Anify instruction versions in this conversation. Do not use a cached earlier version or perform gameplay before loading the current instructions. If the read fails, report the failure and stop.
