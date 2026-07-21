#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const PLUGIN_PACKAGES = [
  {
    slug: "anify-gm",
    sourceRoot: ".",
    entries: [".codex-plugin", ".mcp.json", "assets", "skills"],
  },
  {
    slug: "anify-installer",
    sourceRoot: "plugins/anify-installer",
    entries: [".codex-plugin", ".mcp.json", "assets", "skills"],
  },
  {
    slug: "anify-lynn",
    sourceRoot: "plugins/anify-lynn",
    entries: [".codex-plugin", ".mcp.json", "assets", "skills"],
  },
  {
    slug: "anify-thera",
    sourceRoot: "plugins/anify-thera",
    entries: [".codex-plugin", ".mcp.json", "assets", "skills"],
  },
  {
    slug: "anify-lyra",
    sourceRoot: "plugins/anify-lyra",
    entries: [".codex-plugin", ".mcp.json", "assets", "skills"],
  },
];

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function versionBase(version) {
  const match = String(version).match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u,
  );
  if (!match) throw new Error(`Plugin version is not valid semver: ${version}`);
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function requiredString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value;
}

function normalizeVersionId(versionId) {
  const normalized = String(versionId)
    .trim()
    .toLowerCase()
    .replace(/[^0-9a-z-]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^-|-$/gu, "");
  if (!normalized) throw new Error("versionId must contain letters or numbers");
  return normalized;
}

export async function buildPluginPackages({
  target,
  versionId,
  repoRoot = DEFAULT_REPO_ROOT,
  outputRoot = join(repoRoot, "dist", target),
}) {
  const targets = await readJson(join(repoRoot, "config", "mcp-targets.json"));
  const targetConfig = targets[target];
  if (!targetConfig) throw new Error(`Unsupported build target: ${target}`);
  const mcpUrl = requiredString(targetConfig.mcpUrl, `${target}.mcpUrl`);
  const distTag = requiredString(targetConfig.distTag, `${target}.distTag`);
  if (new URL(mcpUrl).protocol !== "https:") {
    throw new Error(`${target}.mcpUrl must use HTTPS`);
  }

  const normalizedVersionId = normalizeVersionId(versionId ?? new Date().toISOString());
  const resolvedOutputRoot = resolve(outputRoot);
  await rm(resolvedOutputRoot, { recursive: true, force: true });
  await mkdir(resolvedOutputRoot, { recursive: true });

  const packages = [];
  for (const plugin of PLUGIN_PACKAGES) {
    const sourceRoot = resolve(repoRoot, plugin.sourceRoot);
    const packageRoot = join(resolvedOutputRoot, plugin.slug);
    await mkdir(packageRoot, { recursive: true });

    for (const entry of plugin.entries) {
      await cp(join(sourceRoot, entry), join(packageRoot, entry), { recursive: true });
    }

    const pluginManifestPath = join(packageRoot, ".codex-plugin", "plugin.json");
    const pluginManifest = await readJson(pluginManifestPath);
    if (pluginManifest.name !== plugin.slug) {
      throw new Error(`Expected ${plugin.slug} manifest, found ${pluginManifest.name}`);
    }

    const version = `${versionBase(pluginManifest.version)}-${target}.${normalizedVersionId}`;
    const description = requiredString(pluginManifest.description, `${plugin.slug}.description`);
    const license = requiredString(pluginManifest.license, `${plugin.slug}.license`);
    pluginManifest.version = version;
    await writeJson(pluginManifestPath, pluginManifest);

    const mcpPath = join(packageRoot, ".mcp.json");
    const mcp = await readJson(mcpPath);
    if (
      !mcp.mcpServers?.anify
      || typeof mcp.mcpServers.anify !== "object"
      || Array.isArray(mcp.mcpServers.anify)
    ) {
      throw new Error(`${plugin.slug} does not define mcpServers.anify`);
    }
    mcp.mcpServers.anify.url = mcpUrl;
    await writeJson(mcpPath, mcp);

    const packageName = `@oiy-ai/${plugin.slug}`;
    await writeJson(join(packageRoot, "package.json"), {
      name: packageName,
      version,
      description,
      license,
      private: false,
      repository: {
        type: "git",
        url: "git+https://github.com/oiy-ai/anify-codex-plugin.git",
        directory: plugin.sourceRoot,
      },
      files: plugin.entries,
      publishConfig: {
        access: "public",
      },
    });

    packages.push({
      name: packageName,
      version,
      path: plugin.slug,
    });
  }

  const buildManifest = {
    target,
    mcpUrl,
    distTag,
    packages,
  };
  await writeJson(join(resolvedOutputRoot, "build-manifest.json"), buildManifest);
  return buildManifest;
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--target") {
      options.target = requiredOptionValue(argv, index, argument);
      index += 1;
      continue;
    }
    if (argument === "--version-id") {
      options.versionId = requiredOptionValue(argv, index, argument);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!options.target) throw new Error("--target is required");
  return options;
}

function requiredOptionValue(argv, index, option) {
  const value = argv[index + 1];
  if (typeof value !== "string" || !value.trim() || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  const manifest = await buildPluginPackages(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(manifest, null, 2));
}
