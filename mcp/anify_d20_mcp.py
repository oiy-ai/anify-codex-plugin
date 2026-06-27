#!/usr/bin/env python3
"""Minimal stdio MCP server for Anify D20 checks.

The server intentionally keeps a tiny dependency-free surface:
- initialize
- notifications/initialized
- tools/list
- tools/call for roll_check
- ping
- shutdown
"""

from __future__ import annotations

import json
import secrets
import sys
import time
import uuid
from typing import Any


PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "anify-d20"
SERVER_VERSION = "0.1.0"


ROLL_CHECK_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "dc": {
            "type": "integer",
            "minimum": 1,
            "maximum": 40,
            "description": "Difficulty class chosen by the GM.",
        },
        "modifier": {
            "type": "integer",
            "minimum": -20,
            "maximum": 20,
            "default": 0,
            "description": "Total ability, skill, item, and situational modifier.",
        },
        "advantage": {
            "type": "string",
            "enum": ["normal", "advantage", "disadvantage"],
            "default": "normal",
            "description": "Roll mode. Advantage keeps the higher D20; disadvantage keeps lower.",
        },
        "actor": {
            "type": "string",
            "description": "Character, party, NPC, or force taking the checked action.",
        },
        "action": {
            "type": "string",
            "description": "The attempted action being checked.",
        },
        "ability": {
            "type": "string",
            "description": "Ability or skill label, such as DEX(Stealth).",
        },
        "stakes": {
            "type": "string",
            "description": "What success and failure mean in the fiction.",
        },
        "secret": {
            "type": "boolean",
            "default": False,
            "description": "Marks whether the GM should hide raw check detail from the player.",
        },
    },
    "required": ["dc", "action"],
    "additionalProperties": False,
}


def write_message(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def make_error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": {
            "code": code,
            "message": message,
        },
    }


def make_response(request_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "result": result,
    }


def parse_int(value: Any, *, default: int | None = None) -> int:
    if value is None:
        if default is None:
            raise ValueError("missing integer")
        return default
    if isinstance(value, bool):
        raise ValueError("boolean is not an integer")
    return int(value)


def classify(kept_roll: int, total: int, dc: int) -> str:
    if kept_roll == 20:
        return "critical_success"
    if kept_roll == 1:
        return "critical_failure"
    if total >= dc:
        return "success"
    return "failure"


def roll_check(arguments: dict[str, Any]) -> dict[str, Any]:
    dc = parse_int(arguments.get("dc"))
    modifier = parse_int(arguments.get("modifier"), default=0)
    advantage = arguments.get("advantage", "normal")
    if advantage not in {"normal", "advantage", "disadvantage"}:
        raise ValueError("advantage must be normal, advantage, or disadvantage")
    if dc < 1 or dc > 40:
        raise ValueError("dc must be between 1 and 40")
    if modifier < -20 or modifier > 20:
        raise ValueError("modifier must be between -20 and 20")

    first = secrets.randbelow(20) + 1
    rolls = [first]
    kept = first
    if advantage != "normal":
        second = secrets.randbelow(20) + 1
        rolls.append(second)
        kept = max(rolls) if advantage == "advantage" else min(rolls)

    total = kept + modifier
    outcome = classify(kept, total, dc)
    return {
        "check_id": str(uuid.uuid4()),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "actor": str(arguments.get("actor", "")).strip(),
        "action": str(arguments.get("action", "")).strip(),
        "ability": str(arguments.get("ability", "")).strip(),
        "stakes": str(arguments.get("stakes", "")).strip(),
        "secret": bool(arguments.get("secret", False)),
        "dc": dc,
        "modifier": modifier,
        "advantage": advantage,
        "rolls": rolls,
        "kept_roll": kept,
        "total": total,
        "margin": total - dc,
        "outcome": outcome,
    }


def list_tools() -> dict[str, Any]:
    return {
        "tools": [
            {
                "name": "roll_check",
                "description": "Resolve a D20 check with optional modifier, DC, advantage, and structured outcome.",
                "inputSchema": ROLL_CHECK_SCHEMA,
            }
        ]
    }


def call_tool(params: dict[str, Any]) -> dict[str, Any]:
    name = params.get("name")
    arguments = params.get("arguments") or {}
    if name != "roll_check":
        raise ValueError(f"unknown tool: {name}")
    if not isinstance(arguments, dict):
        raise ValueError("arguments must be an object")
    result = roll_check(arguments)
    text = json.dumps(result, ensure_ascii=False, indent=2)
    return {
        "content": [
            {
                "type": "text",
                "text": text,
            }
        ],
        "structuredContent": result,
        "isError": False,
    }


def handle_request(message: dict[str, Any]) -> dict[str, Any] | None:
    request_id = message.get("id")
    method = message.get("method")
    params = message.get("params") or {}
    if not isinstance(params, dict):
        return make_error(request_id, -32602, "params must be an object")

    if method == "notifications/initialized":
        return None
    if method == "initialize":
        return make_response(
            request_id,
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": SERVER_NAME,
                    "version": SERVER_VERSION,
                },
            },
        )
    if method == "ping":
        return make_response(request_id, {})
    if method == "tools/list":
        return make_response(request_id, list_tools())
    if method == "tools/call":
        try:
            return make_response(request_id, call_tool(params))
        except Exception as exc:
            return make_error(request_id, -32602, str(exc))
    if method == "shutdown":
        return make_response(request_id, {})

    return make_error(request_id, -32601, f"method not found: {method}")


def main() -> int:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            message = json.loads(line)
        except json.JSONDecodeError as exc:
            write_message(make_error(None, -32700, f"parse error: {exc}"))
            continue
        if not isinstance(message, dict):
            write_message(make_error(None, -32600, "message must be an object"))
            continue
        response = handle_request(message)
        if response is not None:
            write_message(response)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
