import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
