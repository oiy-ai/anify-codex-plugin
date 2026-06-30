#!/usr/bin/env python3
"""Dependency-free stdio MCP server for Anify.

Authentication intentionally has one gate: a Firebase ID token from the same
Firebase project used by the Anify web app. All adventure tools require a
validated Anify session before gameplay can start.
"""

from __future__ import annotations

import json
import os
import secrets
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any


PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "anify"
SERVER_VERSION = "0.2.0"

FIREBASE_API_KEY = os.environ.get(
    "ANIFY_FIREBASE_API_KEY",
    "AIzaSyBmNZML3E3V3p-4wjQmGJFOutOYd-04dC4",
)
FIREBASE_PROJECT_ID = os.environ.get("ANIFY_FIREBASE_PROJECT_ID", "anify-oiy-ai")
FIREBASE_AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1"
FIREBASE_REFRESH_URL = "https://securetoken.googleapis.com/v1/token"
ANIFY_LOGIN_URL = "https://anify.ai"
REQUEST_TIMEOUT_SECONDS = 20
TOKEN_REFRESH_SKEW_SECONDS = 300
SESSION_PATH = Path(
    os.environ.get(
        "ANIFY_AUTH_SESSION_PATH",
        str(Path.home() / ".anify" / "codex" / "auth-session.json"),
    )
)

class AnifyAuthError(RuntimeError):
    """Raised when the single Firebase Auth path cannot authorize a request."""


class AnifyInputError(RuntimeError):
    """Raised when a tool receives invalid user input."""


EMPTY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {},
    "additionalProperties": False,
}

START_ADVENTURE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "campaign_id": {
            "type": "string",
            "description": "Optional campaign id to bind the authenticated adventure start.",
        },
        "character_id": {
            "type": "string",
            "description": "Optional character id to bind the authenticated adventure start.",
        },
    },
    "additionalProperties": False,
}

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


def login_required_message() -> str:
    return f"Anify Firebase login required. Open {ANIFY_LOGIN_URL} to log in, then retry."


def utc_timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def now_seconds() -> int:
    return int(time.time())


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


def firebase_endpoint(method: str) -> str:
    return f"{FIREBASE_AUTH_BASE_URL}/{method}?key={urllib.parse.quote(FIREBASE_API_KEY)}"


def parse_firebase_error(error: urllib.error.HTTPError) -> str:
    try:
        raw_body = error.read().decode("utf-8")
        body = json.loads(raw_body)
        message = str(body.get("error", {}).get("message", ""))
    except Exception:
        message = ""

    normalized = message.upper()
    if normalized in {"EMAIL_NOT_FOUND", "INVALID_PASSWORD", "INVALID_LOGIN_CREDENTIALS"}:
        return "Invalid Anify account email or password."
    if normalized == "USER_DISABLED":
        return "This Anify account is disabled."
    if normalized == "TOO_MANY_ATTEMPTS_TRY_LATER":
        return "Firebase temporarily rate-limited this login. Try again later."
    if normalized in {"INVALID_ID_TOKEN", "TOKEN_EXPIRED"}:
        return "The stored Anify Firebase session is invalid or expired."
    if message:
        return f"Firebase Auth rejected the request: {message}."
    return f"Firebase Auth request failed with HTTP {error.code}."


def post_json(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise AnifyAuthError(parse_firebase_error(error)) from error
    except urllib.error.URLError as error:
        raise AnifyAuthError(f"Could not reach Firebase Auth: {error.reason}.") from error
    except json.JSONDecodeError as error:
        raise AnifyAuthError("Firebase Auth returned an invalid response.") from error


def post_form(url: str, payload: dict[str, str]) -> dict[str, Any]:
    encoded = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise AnifyAuthError(parse_firebase_error(error)) from error
    except urllib.error.URLError as error:
        raise AnifyAuthError(f"Could not reach Firebase Auth: {error.reason}.") from error
    except json.JSONDecodeError as error:
        raise AnifyAuthError("Firebase Auth returned an invalid response.") from error


def lookup_firebase_user(id_token: str) -> dict[str, Any]:
    response = post_json(firebase_endpoint("accounts:lookup"), {"idToken": id_token})
    users = response.get("users")
    if not isinstance(users, list) or not users:
        raise AnifyAuthError("Firebase Auth did not return a user for this session.")
    user = users[0]
    if not isinstance(user, dict):
        raise AnifyAuthError("Firebase Auth returned an invalid user profile.")
    return user


def normalize_user(firebase_user: dict[str, Any], fallback_uid: str | None = None) -> dict[str, Any]:
    uid = str(firebase_user.get("localId") or fallback_uid or "").strip()
    if not uid:
        raise AnifyAuthError("Firebase Auth did not return a user id.")
    return {
        "uid": uid,
        "email": firebase_user.get("email"),
        "displayName": firebase_user.get("displayName"),
        "emailVerified": bool(firebase_user.get("emailVerified", False)),
    }


def session_public_payload(session: dict[str, Any]) -> dict[str, Any]:
    return {
        "authenticated": True,
        "project_id": session.get("projectId"),
        "uid": session.get("uid"),
        "email": session.get("email"),
        "displayName": session.get("displayName"),
        "emailVerified": session.get("emailVerified"),
        "expiresAt": session.get("expiresAt"),
        "source": session.get("source"),
        "sessionPath": str(SESSION_PATH),
    }


def ensure_session_parent() -> None:
    SESSION_PATH.parent.mkdir(parents=True, exist_ok=True)
    os.chmod(SESSION_PATH.parent, 0o700)


def write_session(session: dict[str, Any]) -> None:
    ensure_session_parent()
    fd, temp_path = tempfile.mkstemp(prefix=".auth-session.", suffix=".json", dir=SESSION_PATH.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(session, handle, indent=2)
            handle.write("\n")
        os.chmod(temp_path, 0o600)
        os.replace(temp_path, SESSION_PATH)
        os.chmod(SESSION_PATH, 0o600)
    finally:
        try:
            os.unlink(temp_path)
        except FileNotFoundError:
            pass


def read_session() -> dict[str, Any] | None:
    if not SESSION_PATH.is_file():
        return None
    try:
        payload = json.loads(SESSION_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    return payload


def delete_session() -> None:
    try:
        SESSION_PATH.unlink()
    except FileNotFoundError:
        return


def build_session(
    *,
    id_token: str,
    refresh_token: str,
    expires_in: Any,
    firebase_user: dict[str, Any],
    fallback_uid: str | None = None,
) -> dict[str, Any]:
    user = normalize_user(firebase_user, fallback_uid=fallback_uid)
    if not user["emailVerified"]:
        raise AnifyAuthError("Email verification is required before Anify Codex login.")

    expires_at = now_seconds() + int(expires_in)
    return {
        "schemaVersion": 1,
        "projectId": FIREBASE_PROJECT_ID,
        "uid": user["uid"],
        "email": user["email"],
        "displayName": user["displayName"],
        "emailVerified": user["emailVerified"],
        "idToken": id_token,
        "refreshToken": refresh_token,
        "expiresAt": expires_at,
        "issuedAt": now_seconds(),
        "source": "stored_session",
    }


def refresh_session(session: dict[str, Any]) -> dict[str, Any]:
    refresh_token = str(session.get("refreshToken", ""))
    if not refresh_token:
        delete_session()
        raise AnifyAuthError("Anify login required. Stored session has no Firebase refresh token.")

    response = post_form(
        f"{FIREBASE_REFRESH_URL}?key={urllib.parse.quote(FIREBASE_API_KEY)}",
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
    )
    id_token = str(response.get("id_token", ""))
    new_refresh_token = str(response.get("refresh_token") or refresh_token)
    expires_in = response.get("expires_in")
    if not id_token or expires_in is None:
        delete_session()
        raise AnifyAuthError("Firebase Auth refresh did not return a complete session.")

    firebase_user = lookup_firebase_user(id_token)
    refreshed = build_session(
        id_token=id_token,
        refresh_token=new_refresh_token,
        expires_in=expires_in,
        firebase_user=firebase_user,
        fallback_uid=str(response.get("user_id", session.get("uid", ""))),
    )
    write_session(refreshed)
    return refreshed


def require_authenticated_session() -> dict[str, Any]:
    session = read_session()
    if session is None:
        raise AnifyAuthError(login_required_message())

    if session.get("source") == "shell_bearer":
        return session_from_shell_bearer(session)

    expires_at = int(session.get("expiresAt") or 0)
    if expires_at <= now_seconds() + TOKEN_REFRESH_SKEW_SECONDS:
        session = refresh_session(session)

    id_token = str(session.get("idToken", ""))
    if not id_token:
        delete_session()
        raise AnifyAuthError("Anify login required. Stored Firebase session is incomplete.")

    firebase_user = lookup_firebase_user(id_token)
    user = normalize_user(firebase_user, fallback_uid=str(session.get("uid", "")))
    if not user["emailVerified"]:
        delete_session()
        raise AnifyAuthError("Email verification is required before Anify Codex login.")

    session.update(
        {
            "uid": user["uid"],
            "email": user["email"],
            "displayName": user["displayName"],
            "emailVerified": user["emailVerified"],
            "source": "stored_session",
        }
    )
    write_session(session)
    return session


def session_from_shell_bearer(session: dict[str, Any]) -> dict[str, Any]:
    id_token = str(session.get("idToken", "")).strip()
    if not id_token:
        raise AnifyAuthError("Anify login required. Shell Firebase session is incomplete.")

    firebase_user = lookup_firebase_user(id_token)
    user = normalize_user(firebase_user, fallback_uid=str(session.get("uid", "")))
    expected_uid = str(session.get("uid", "")).strip()
    if expected_uid and user["uid"] != expected_uid:
        raise AnifyAuthError("Anify Firebase token uid does not match the shell-authenticated user.")
    if not user["emailVerified"]:
        raise AnifyAuthError("Email verification is required before Anify Codex login.")

    return {
        "schemaVersion": 1,
        "projectId": FIREBASE_PROJECT_ID,
        "uid": user["uid"],
        "email": user["email"],
        "displayName": user["displayName"],
        "emailVerified": user["emailVerified"],
        "idToken": id_token,
        "refreshToken": None,
        "expiresAt": session.get("expiresAt"),
        "issuedAt": session.get("issuedAt") or now_seconds(),
        "source": "shell_bearer",
    }


def auth_status() -> dict[str, Any]:
    try:
        session = require_authenticated_session()
    except AnifyAuthError as error:
        return {
            "authenticated": False,
            "project_id": FIREBASE_PROJECT_ID,
            "sessionPath": str(SESSION_PATH),
            "code": "ANIFY_LOGIN_REQUIRED",
            "action": "open_login_url",
            "loginUrl": ANIFY_LOGIN_URL,
            "message": str(error),
        }
    public = session_public_payload(session)
    public["message"] = "Anify Firebase session is active."
    return public


def auth_logout() -> dict[str, Any]:
    delete_session()
    return {
        "authenticated": False,
        "project_id": FIREBASE_PROJECT_ID,
        "sessionPath": str(SESSION_PATH),
        "message": "Anify Firebase session cleared.",
    }


def start_adventure(arguments: dict[str, Any]) -> dict[str, Any]:
    session = require_authenticated_session()
    return {
        "adventure_session_id": str(uuid.uuid4()),
        "startedAt": utc_timestamp(),
        "readyForGameplay": False,
        "requiresCloudState": True,
        "blockedReason": "server_state_mcp_not_configured",
        "campaign_id": str(arguments.get("campaign_id", "")).strip() or None,
        "character_id": str(arguments.get("character_id", "")).strip() or None,
        "auth": {
            "project_id": session.get("projectId"),
            "uid": session.get("uid"),
            "email": session.get("email"),
            "displayName": session.get("displayName"),
            "source": session.get("source"),
        },
        "message": "Anify Firebase auth succeeded, but server-side adventure state MCP tools are not connected yet. Do not start local gameplay.",
    }


def parse_int(value: Any, *, default: int | None = None) -> int:
    if value is None:
        if default is None:
            raise AnifyInputError("missing integer")
        return default
    if isinstance(value, bool):
        raise AnifyInputError("boolean is not an integer")
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
    require_authenticated_session()

    dc = parse_int(arguments.get("dc"))
    modifier = parse_int(arguments.get("modifier"), default=0)
    advantage = arguments.get("advantage", "normal")
    if advantage not in {"normal", "advantage", "disadvantage"}:
        raise AnifyInputError("advantage must be normal, advantage, or disadvantage")
    if dc < 1 or dc > 40:
        raise AnifyInputError("dc must be between 1 and 40")
    if modifier < -20 or modifier > 20:
        raise AnifyInputError("modifier must be between -20 and 20")

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
        "timestamp": utc_timestamp(),
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
                "name": "anify_auth_status",
                "description": "Check the Anify Firebase session and return the web login URL when login is required.",
                "inputSchema": EMPTY_SCHEMA,
            },
            {
                "name": "anify_auth_logout",
                "description": "Clear the stored Anify Firebase session.",
                "inputSchema": EMPTY_SCHEMA,
            },
            {
                "name": "anify_start_adventure",
                "description": "Authenticate and gate Anify adventure startup. Requires Firebase auth and server-side cloud state readiness.",
                "inputSchema": START_ADVENTURE_SCHEMA,
            },
            {
                "name": "roll_check",
                "description": "Resolve an authenticated D20 check with optional modifier, DC, advantage, and structured outcome.",
                "inputSchema": ROLL_CHECK_SCHEMA,
            },
        ]
    }


def tool_response(result: dict[str, Any]) -> dict[str, Any]:
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


def call_tool(params: dict[str, Any]) -> dict[str, Any]:
    name = params.get("name")
    arguments = params.get("arguments") or {}
    if not isinstance(arguments, dict):
        raise AnifyInputError("arguments must be an object")

    if name == "anify_auth_status":
        return tool_response(auth_status())
    if name == "anify_auth_logout":
        return tool_response(auth_logout())
    if name == "anify_start_adventure":
        return tool_response(start_adventure(arguments))
    if name == "roll_check":
        return tool_response(roll_check(arguments))

    raise AnifyInputError(f"unknown tool: {name}")


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
        except (AnifyAuthError, AnifyInputError) as exc:
            return make_error(request_id, -32602, str(exc))
        except Exception:
            return make_error(request_id, -32603, "Anify MCP server failed unexpectedly.")
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
