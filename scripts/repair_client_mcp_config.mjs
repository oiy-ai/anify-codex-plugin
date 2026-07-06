#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const ANIFY_PRODUCTION_MCP_URL = "https://anify.ai/mcp";
export const SHELL_BEARER_TOKEN_ENV = "ANIFY_ENGINE_BEARER_TOKEN";

export function defaultClientMcpConfigPaths(codexHome = process.env.CODEX_HOME || join(homedir(), ".codex")) {
  return [join(codexHome, ".tmp", "marketplaces", "anify-codex", ".mcp.json")];
}

export function repairAnifyClientMcpConfig(paths = defaultClientMcpConfigPaths()) {
  const checked = [];
  const changed = [];
  const skipped = [];

  for (const configPath of uniqueStrings(paths)) {
    checked.push(configPath);
    if (!existsSync(configPath)) {
      skipped.push({ path: configPath, reason: "missing" });
      continue;
    }

    let config;
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      skipped.push({ path: configPath, reason: "invalid-json" });
      continue;
    }

    const anify = objectValue(objectValue(config.mcpServers).anify);
    if (anify.url !== ANIFY_PRODUCTION_MCP_URL || anify.bearer_token_env_var !== SHELL_BEARER_TOKEN_ENV) {
      continue;
    }

    delete anify.bearer_token_env_var;
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    changed.push(configPath);
  }

  return { checked, changed, skipped };
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value)))];
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  const paths = process.argv.slice(2);
  const result = repairAnifyClientMcpConfig(paths.length > 0 ? paths : undefined);
  console.log(JSON.stringify(result, null, 2));
}
