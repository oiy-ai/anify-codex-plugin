import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  PLUGIN_PACKAGES,
  buildPluginPackages,
} from "../scripts/build_plugin_packages.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const targets = JSON.parse(await readFile(join(repoRoot, "config", "mcp-targets.json"), "utf8"));

async function json(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function createFixtureRepo() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "anify-codex-fixture-"));
  const sourcePaths = new Set(["config/mcp-targets.json"]);
  for (const plugin of PLUGIN_PACKAGES) {
    for (const entry of plugin.entries) {
      sourcePaths.add(join(plugin.sourceRoot, entry));
    }
  }
  for (const sourcePath of sourcePaths) {
    const targetPath = join(fixtureRoot, sourcePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(join(repoRoot, sourcePath), targetPath, { recursive: true });
  }
  return fixtureRoot;
}

async function filesUnder(path) {
  if ((await stat(path)).isFile()) return [path];
  const files = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

function portablePath(path) {
  return path.split(sep).join("/");
}

for (const target of ["preview", "production"]) {
  test(`builds ${target} npm packages without changing source manifests`, async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), `anify-codex-${target}-`));
    try {
      const outputRoot = join(temporaryRoot, target);
      const buildManifest = await buildPluginPackages({
        target,
        versionId: "fixture-1",
        repoRoot,
        outputRoot,
      });

      assert.equal(buildManifest.target, target);
      assert.equal(buildManifest.mcpUrl, targets[target].mcpUrl);
      assert.equal(buildManifest.distTag, targets[target].distTag);
      assert.deepEqual(
        buildManifest.packages.map((entry) => entry.name),
        PLUGIN_PACKAGES.map((entry) => `@oiy-ai/${entry.slug}`),
      );

      for (const plugin of PLUGIN_PACKAGES) {
        const packageRoot = join(outputRoot, plugin.slug);
        const packageManifest = await json(join(packageRoot, "package.json"));
        const pluginManifest = await json(join(packageRoot, ".codex-plugin", "plugin.json"));
        const mcp = await json(join(packageRoot, ".mcp.json"));

        assert.equal(packageManifest.name, `@oiy-ai/${plugin.slug}`);
        assert.match(packageManifest.version, new RegExp(`^\\d+\\.\\d+\\.\\d+-${target}\\.fixture-1$`, "u"));
        assert.equal(packageManifest.version, pluginManifest.version);
        assert.equal(packageManifest.license, "MIT");
        assert.deepEqual(packageManifest.files, plugin.entries);
        assert.equal(packageManifest.publishConfig.access, "public");
        assert.equal(mcp.mcpServers.anify.url, targets[target].mcpUrl);
        assert.deepEqual(mcp.mcpServers.anify.env_http_headers, {
          "x-anify-operation-id": "ANIFY_OPERATION_ID",
        });
      }
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
}

test("rejects unsupported build targets", async () => {
  await assert.rejects(
    buildPluginPackages({ target: "staging", versionId: "fixture", repoRoot }),
    /Unsupported build target: staging/u,
  );
});

test("rejects invalid source manifest identity and version metadata", async () => {
  const fixtureRoot = await createFixtureRepo();
  try {
    const manifestPath = join(fixtureRoot, ".codex-plugin", "plugin.json");
    const manifest = await json(manifestPath);

    await writeJson(manifestPath, { ...manifest, name: "wrong-plugin" });
    await assert.rejects(
      buildPluginPackages({ target: "preview", versionId: "fixture", repoRoot: fixtureRoot }),
      /Expected anify-gm manifest, found wrong-plugin/u,
    );

    await writeJson(manifestPath, { ...manifest, version: "1.2.3.4" });
    await assert.rejects(
      buildPluginPackages({ target: "preview", versionId: "fixture", repoRoot: fixtureRoot }),
      /Plugin version is not valid semver: 1\.2\.3\.4/u,
    );

    await writeJson(manifestPath, { ...manifest, license: "" });
    await assert.rejects(
      buildPluginPackages({ target: "preview", versionId: "fixture", repoRoot: fixtureRoot }),
      /anify-gm\.license must be a non-empty string/u,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("rejects malformed source MCP definitions", async () => {
  const fixtureRoot = await createFixtureRepo();
  try {
    const mcpPath = join(fixtureRoot, ".mcp.json");
    const mcp = await json(mcpPath);
    mcp.mcpServers.anify = "https://anify.invalid/mcp";
    await writeJson(mcpPath, mcp);

    await assert.rejects(
      buildPluginPackages({ target: "preview", versionId: "fixture", repoRoot: fixtureRoot }),
      /anify-gm does not define mcpServers\.anify/u,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("rejects non-HTTPS target MCP URLs", async () => {
  const fixtureRoot = await createFixtureRepo();
  try {
    const targetsPath = join(fixtureRoot, "config", "mcp-targets.json");
    const fixtureTargets = await json(targetsPath);
    fixtureTargets.preview.mcpUrl = "http://anify.invalid/mcp";
    await writeJson(targetsPath, fixtureTargets);

    await assert.rejects(
      buildPluginPackages({ target: "preview", versionId: "fixture", repoRoot: fixtureRoot }),
      /preview\.mcpUrl must use HTTPS/u,
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("rejects empty normalized build version identifiers", async () => {
  await assert.rejects(
    buildPluginPackages({ target: "preview", versionId: "***", repoRoot }),
    /versionId must contain letters or numbers/u,
  );
});

test("CLI rejects flags without values and unknown arguments", () => {
  const scriptPath = join(repoRoot, "scripts", "build_plugin_packages.mjs");
  for (const [args, message] of [
    [[], "--target is required"],
    [["--target"], "--target requires a value"],
    [["--target", "preview", "--version-id"], "--version-id requires a value"],
    [["--unknown"], "Unknown argument: --unknown"],
  ]) {
    const result = spawnSync(process.execPath, [scriptPath, ...args], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  }

  const result = spawnSync(
    process.execPath,
    [scriptPath, "--target", "preview", "--version-id", "cli-fixture"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).target, "preview");
});

test("every packaged resource is reachable from a plugin entry point", async () => {
  for (const plugin of PLUGIN_PACKAGES) {
    const sourceRoot = join(repoRoot, plugin.sourceRoot);
    const manifest = await json(join(sourceRoot, ".codex-plugin", "plugin.json"));
    const manifestText = JSON.stringify(manifest);
    const packagedFiles = (await Promise.all(
      plugin.entries.map((entry) => filesUnder(join(sourceRoot, entry))),
    )).flat();
    const skillFiles = packagedFiles.filter((path) => path.endsWith(`${sep}SKILL.md`));
    const skills = await Promise.all(skillFiles.map(async (path) => ({
      path,
      text: await readFile(path, "utf8"),
    })));

    for (const file of packagedFiles) {
      const packagedPath = portablePath(relative(sourceRoot, file));
      if (packagedPath === ".codex-plugin/plugin.json" || packagedPath === ".mcp.json") continue;
      if (packagedPath.startsWith("assets/")) {
        assert.ok(manifestText.includes(`./${packagedPath}`), `${plugin.slug}: unreferenced asset ${packagedPath}`);
        continue;
      }
      if (file.endsWith(`${sep}SKILL.md`)) continue;

      const owner = skills.find((skill) => file.startsWith(`${dirname(skill.path)}${sep}`));
      assert.ok(owner, `${plugin.slug}: unsupported packaged file ${packagedPath}`);
      const resourcePath = portablePath(relative(dirname(owner.path), file));
      assert.ok(owner.text.includes(resourcePath), `${plugin.slug}: unreferenced skill resource ${packagedPath}`);
    }
  }
});
