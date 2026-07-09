import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const webIconRoot = join(repoRoot, '..', 'anify-web', 'public', 'icons');

function text(path) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

function json(path) {
  return JSON.parse(text(path));
}

function bytes(path) {
  return readFileSync(join(repoRoot, path));
}

function webIcon(path) {
  return readFileSync(join(webIconRoot, path));
}

const gmSkill = text('skills/anify-gm-adventure/SKILL.md');
const orchestration = text('skills/anify-gm-adventure/references/orchestration.md');
const authentication = text('skills/anify-gm-adventure/references/authentication.md');
const d20 = text('skills/anify-gm-adventure/references/d20-mcp-contract.md');
const memory = text('skills/anify-gm-adventure/references/memory-and-consistency.md');
const gmManifest = json('.codex-plugin/plugin.json');
const installerManifest = json('plugins/anify-installer/.codex-plugin/plugin.json');
const marketplace = json('.agents/plugins/marketplace.json');
const gmMcp = json('.mcp.json');
const installerMcp = json('plugins/anify-installer/.mcp.json');
const roles = [
  ['lynn', 'Anify-Lynn', 'Lynn', 'Lynn Tale'],
  ['thera', 'Anify-Thera', 'Thera', 'Thera Valeria'],
  ['lyra', 'Anify-Lyra', 'Lyra', 'Lyra Oravia'],
];

function roleRoot(role) {
  return `plugins/anify-${role}`;
}

function roleManifest(role) {
  return json(`${roleRoot(role)}/.codex-plugin/plugin.json`);
}

function roleMcp(role) {
  return json(`${roleRoot(role)}/.mcp.json`);
}

function roleHooks(role) {
  return json(`${roleRoot(role)}/hooks/hooks.json`);
}

test('marketplace exposes installer, GM, and role plugins', () => {
  assert.equal(marketplace.name, 'anify-codex');
  assert.equal(marketplace.interface.displayName, 'Oiy AI');
  assert.deepEqual(
    marketplace.plugins.map((plugin) => [plugin.name, plugin.source.path, plugin.category, plugin.policy.authentication]),
    [
      ['anify-installer', './plugins/anify-installer', 'Productivity', 'ON_INSTALL'],
      ['anify-gm', '.', 'Entertainment', 'ON_USE'],
      ['anify-lynn', './plugins/anify-lynn', 'Entertainment', 'ON_USE'],
      ['anify-thera', './plugins/anify-thera', 'Entertainment', 'ON_USE'],
      ['anify-lyra', './plugins/anify-lyra', 'Entertainment', 'ON_USE'],
    ],
  );
});

test('installer plugin identity, MCP, assets, and skill are valid', () => {
  assert.equal(installerManifest.name, 'anify-installer');
  assert.equal(installerManifest.interface.displayName, 'Anify Installer');
  assert.equal(installerManifest.skills, './skills/');
  assert.equal(installerManifest.mcpServers, './.mcp.json');
  assert.equal(installerMcp.mcpServers.anify.type, 'http');
  assert.equal(installerMcp.mcpServers.anify.url, 'https://anify.ai/mcp');
  assert.match(text('plugins/anify-installer/skills/anify-installer/SKILL.md'), /init-save --name/);

  for (const size of [192, 512]) {
    const icon = bytes(`plugins/anify-installer/assets/icon-${size}x${size}.png`);
    assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.deepEqual(icon, webIcon(`icon-${size}x${size}.png`));
  }
});

test('GM plugin identity and assets match Anify-GM branding', () => {
  assert.equal(gmManifest.name, 'anify-gm');
  assert.equal(gmManifest.interface.displayName, 'Anify-GM');
  assert.equal(gmManifest.interface.shortDescription, 'Run Anify adventures with an initialized GM save.');
  assert.match(gmManifest.interface.longDescription, /initialized local campaign progress/);
  assert.equal(gmManifest.interface.composerIcon, './assets/icon-192x192.png');
  assert.equal(gmManifest.interface.logo, './assets/icon-512x512.png');

  for (const size of [192, 512]) {
    const icon = bytes(`assets/icon-${size}x${size}.png`);
    assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
    assert.equal(icon.readUInt32BE(16), size);
    assert.equal(icon.readUInt32BE(20), size);
    assert.deepEqual(icon, webIcon(`icon-${size}x${size}.png`));
  }
});

test('GM skill uses the GM workspace and progress save files', () => {
  for (const file of ['profile.md', 'progress.md', 'save.md', 'gm-memory.md', 'party-memory.md', 'turn-log.md']) {
    assert.match(gmSkill, new RegExp(file.replace('.', '\\.')));
  }
  for (const source of [gmSkill, orchestration, authentication, d20, memory]) {
    assert.match(source, /CODEX_HOME\/anify\/users\/userA\/GM/);
    assert.doesNotMatch(source, /CODEX_HOME\/anify\/userA\/GM/);
  }
  assert.match(gmSkill, /run Anify Installer/);
  assert.match(gmSkill, /Do not create missing save files/);
});

test('GM skill keeps Engine MCP as the D20 authority', () => {
  for (const tool of [
    'anify_start_adventure',
    'anify_get_context',
    'roll_check',
    'anify_resolve_action',
  ]) {
    assert.match(gmSkill, new RegExp(tool));
  }
  for (const source of [gmSkill, orchestration, authentication, d20]) {
    assert.doesNotMatch(source, /anify_auth_status/);
  }
  assert.match(d20, /The GM must not alter `rolls`/);
});

test('all plugins share the Anify Engine MCP config', () => {
  assert.equal(gmMcp.mcpServers.anify.type, 'http');
  assert.equal(gmMcp.mcpServers.anify.url, 'https://anify.ai/mcp');
  assert.equal(gmMcp.mcpServers.anify.bearer_token_env_var, undefined);
  for (const [slug] of roles) {
    assert.deepEqual(roleMcp(slug), gmMcp);
  }
});

test('role plugins expose persona skills and shared character workflow', () => {
  const sharedSkill = text('shared/anify-character/skills/anify-character-chat/SKILL.md');
  assert.match(sharedSkill, /memory\/history\.db/);
  assert.match(sharedSkill, /memory\/qdrant/);
  assert.match(sharedSkill, /CODEX_HOME\/anify\/users\/userA\/<Character>/);
  assert.doesNotMatch(sharedSkill, /mem0/i);

  for (const [slug, displayName, character, fullName] of roles) {
    const manifest = roleManifest(slug);
    assert.equal(manifest.name, `anify-${slug}`);
    assert.equal(manifest.interface.displayName, displayName);
    assert.equal(manifest.interface.category, 'Entertainment');
    assert.equal(manifest.interface.composerIcon, './assets/icon-192x192.png');
    assert.equal(manifest.interface.logo, './assets/icon-512x512.png');
    assert.equal(manifest.mcpServers, './.mcp.json');
    assert.equal(manifest.hooks, undefined);

    for (const size of [192, 512]) {
      const icon = bytes(`${roleRoot(slug)}/assets/icon-${size}x${size}.png`);
      assert.equal(icon.subarray(1, 4).toString('ascii'), 'PNG');
      assert.equal(icon.readUInt32BE(16), size);
      assert.equal(icon.readUInt32BE(20), size);
      assert.deepEqual(icon, webIcon(`${slug}/icon-${size}x${size}.png`));
    }

    const persona = text(`${roleRoot(slug)}/skills/anify-${slug}-persona/SKILL.md`);
    assert.match(persona, new RegExp(`CODEX_HOME/anify/users/userA/${character}`));
    assert.match(persona, new RegExp(fullName));

    const localWorkflow = text(`${roleRoot(slug)}/skills/anify-character-chat/SKILL.md`);
    assert.match(localWorkflow, /\.\.\/\.\.\/shared\/anify-character\/skills\/anify-character-chat\/SKILL\.md/);
  }
});

test('role hooks capture prompts, stops, compactions, and session starts', () => {
  const expectedEvents = ['SessionStart', 'UserPromptSubmit', 'Stop', 'PostCompact'];
  for (const [slug, , character] of roles) {
    const hooks = roleHooks(slug).hooks;
    assert.deepEqual(Object.keys(hooks).sort(), expectedEvents.sort());
    const encodedHooks = JSON.stringify(hooks);
    assert.match(encodedHooks, /shared\/anify-character\/hooks\/anify_memory_runtime\.sh/);
    assert.doesNotMatch(encodedHooks, /python3/);
    assert.doesNotMatch(encodedHooks, /anify_character_hooks\.py/);
    assert.doesNotMatch(encodedHooks, /\.\.\/\.\.\//);
    assert.match(encodedHooks, new RegExp(`--character ${character}`));
    assert.equal(existsSync(join(repoRoot, roleRoot(slug), 'hooks', 'anify_character_hooks.py')), false);
  }

  assert.equal(existsSync(join(repoRoot, 'shared/anify-character/hooks/anify_character_hooks.py')), true);
  assert.equal(existsSync(join(repoRoot, 'shared/anify-character/hooks/anify_memory_runtime.sh')), true);
});

test('role packages carry synced shared character runtime for plugin cache installs', () => {
  const sharedHook = text('shared/anify-character/hooks/anify_character_hooks.py');
  const sharedWrapper = text('shared/anify-character/hooks/anify_memory_runtime.sh');
  const sharedSkill = text('shared/anify-character/skills/anify-character-chat/SKILL.md');

  for (const [slug] of roles) {
    assert.equal(
      text(`${roleRoot(slug)}/shared/anify-character/hooks/anify_character_hooks.py`),
      sharedHook,
    );
    assert.equal(
      text(`${roleRoot(slug)}/shared/anify-character/hooks/anify_memory_runtime.sh`),
      sharedWrapper,
    );
    assert.equal(
      text(`${roleRoot(slug)}/shared/anify-character/skills/anify-character-chat/SKILL.md`),
      sharedSkill,
    );
  }
});

test('character hook script stores local long-term character memory', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'anify-character-hooks-'));
  const stubRoot = join(tempDir, 'python-stub');
  installMem0Stub(stubRoot);
  const transcriptPath = join(tempDir, 'transcript.jsonl');
  writeFileSync(transcriptPath, '{"type":"user","text":"hello Lynn"}\n{"type":"assistant","text":"hello"}\n');

  const script = join(repoRoot, 'shared/anify-character/hooks/anify_character_hooks.py');
  const env = {
    ...process.env,
    CODEX_HOME: tempDir,
    PYTHONPATH: [stubRoot, process.env.PYTHONPATH].filter(Boolean).join(':'),
  };
  const basePayload = {
    session_id: 'session-1',
    turn_id: 'turn-1',
    transcript_path: transcriptPath,
    cwd: repoRoot,
    model: 'gpt-test',
  };

  try {
    const record = runHook(script, ['user-prompt', '--character', 'Lynn'], {
      ...basePayload,
      hook_event_name: 'UserPromptSubmit',
      prompt: 'what did we discuss about tea?',
    }, env);
    const promptContext = JSON.parse(record.stdout);
    assert.match(promptContext.hookSpecificOutput.additionalContext, /Relevant Lynn long-term memories/);
    assert.doesNotMatch(promptContext.hookSpecificOutput.additionalContext, /mem0/i);

    const workspace = join(tempDir, 'anify', 'users', 'userA', 'Lynn');
    const eventLog = textFrom(workspace, 'memory/hook-events.jsonl').trim().split('\n').map(JSON.parse);
    assert.equal(eventLog[0].event, 'UserPromptSubmit');
    assert.equal(eventLog[0].transcript_snapshot.available, true);
    assert.match(eventLog[0].transcript_snapshot.snapshot_path, /memory\/transcripts/);
    assert.equal(textFromPath(eventLog[0].transcript_snapshot.snapshot_path), textFromPath(transcriptPath));
    assert.equal(existsSync(join(workspace, 'memory', 'master.md')), false);

    runHook(script, ['post-compact', '--character', 'Lynn'], {
      ...basePayload,
      hook_event_name: 'PostCompact',
      trigger: 'auto',
    }, env);
    const operations = textFrom(workspace, 'memory/memory-operations.jsonl').trim().split('\n').map(JSON.parse);
    assert.equal(operations[0].status, 'stored');
    assert.equal(operations[0].message_count, 2);

    const mem0Adds = textFrom(workspace, 'memory/stub-adds.jsonl').trim().split('\n').map(JSON.parse);
    assert.equal(mem0Adds[0].user_id, 'userA');
    assert.equal(mem0Adds[0].agent_id, 'character:Lynn');
    assert.equal(mem0Adds[0].run_id, 'session-1');
    assert.equal(mem0Adds[0].infer, true);
    assert.equal(mem0Adds[0].metadata.character, 'Lynn');
    assert.equal(mem0Adds[0].metadata.memory_type, 'character_long_term');
    assert.match(mem0Adds[0].metadata.source_snapshot_path, /memory\/transcripts/);
    assert.deepEqual(mem0Adds[0].messages.map((message) => message.role), ['user', 'assistant']);

    const mem0Config = JSON.parse(textFrom(workspace, 'memory/stub-config.json'));
    assert.equal(mem0Config.history_db_path, join(workspace, 'memory', 'history.db'));
    assert.equal(mem0Config.vector_store.provider, 'qdrant');
    assert.equal(mem0Config.vector_store.config.path, join(workspace, 'memory', 'qdrant'));
    assert.equal(mem0Config.vector_store.config.collection_name, 'anify_lynn');

    const startup = runHook(script, ['session-start', '--character', 'Lynn'], {
      ...basePayload,
      hook_event_name: 'SessionStart',
      source: 'startup',
    }, env);
    assert.match(startup.stdout, /Anify character startup context for Lynn/);
    assert.match(startup.stdout, /Memory directory/);
    assert.match(startup.stdout, /Loaded long-term memories for Lynn/);
    assert.doesNotMatch(startup.stdout, /mem0/i);
    assert.doesNotMatch(startup.stdout, /Master memory/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('installer script initializes local GM save files', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'anify-installer-'));
  const script = join(repoRoot, 'plugins/anify-installer/scripts/anify_installer.py');
  const env = { ...process.env, CODEX_HOME: tempDir };

  try {
    const result = spawnSync('python3', [
      script,
      'init-save',
      '--name',
      'Mira',
      '--profession',
      'Ranger',
      '--gender',
      'Female',
      '--other',
      'Keeps a silver compass.',
    ], { encoding: 'utf8', env });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const workspace = join(tempDir, 'anify', 'users', 'userA', 'GM');
    for (const file of ['profile.md', 'progress.md', 'save.md', 'gm-memory.md', 'party-memory.md', 'turn-log.md']) {
      assert.equal(existsSync(join(workspace, file)), true);
    }
    assert.match(textFrom(workspace, 'profile.md'), /Name: Mira/);
    assert.match(textFrom(workspace, 'profile.md'), /Profession: Ranger/);
    assert.match(textFrom(workspace, 'profile.md'), /Gender: Female/);
    assert.match(textFrom(workspace, 'save.md'), /Keeps a silver compass/);

    const rerun = spawnSync('python3', [
      script,
      'init-save',
      '--name',
      'Mira',
      '--profession',
      'Ranger',
      '--gender',
      'Female',
    ], { encoding: 'utf8', env });
    assert.notEqual(rerun.status, 0);
    assert.match(rerun.stderr || rerun.stdout, /already exists/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('legacy client repair only removes shell bearer config from production Anify MCP', async () => {
  const { repairAnifyClientMcpConfig } = await import('../scripts/repair_client_mcp_config.mjs');
  const tempDir = mkdtempSync(join(tmpdir(), 'anify-client-repair-'));
  const productionConfig = join(tempDir, 'production.mcp.json');
  const shellConfig = join(tempDir, 'shell.mcp.json');

  try {
    writeFileSync(
      productionConfig,
      `${JSON.stringify({
        mcpServers: {
          anify: {
            type: 'http',
            url: 'https://anify.ai/mcp',
            bearer_token_env_var: 'ANIFY_ENGINE_BEARER_TOKEN',
          },
        },
      })}\n`,
    );
    writeFileSync(
      shellConfig,
      `${JSON.stringify({
        mcpServers: {
          anify: {
            type: 'http',
            url: 'http://host.docker.internal:8788/mcp',
            bearer_token_env_var: 'ANIFY_ENGINE_BEARER_TOKEN',
          },
        },
      })}\n`,
    );

    const result = repairAnifyClientMcpConfig([productionConfig, shellConfig, productionConfig]);
    assert.deepEqual(result.changed, [productionConfig]);

    const repairedProduction = JSON.parse(readFileSync(productionConfig, 'utf8'));
    const untouchedShell = JSON.parse(readFileSync(shellConfig, 'utf8'));
    assert.equal(repairedProduction.mcpServers.anify.bearer_token_env_var, undefined);
    assert.equal(untouchedShell.mcpServers.anify.bearer_token_env_var, 'ANIFY_ENGINE_BEARER_TOKEN');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function runHook(script, args, payload, env) {
  const result = spawnSync('python3', [script, ...args], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result;
}

function textFrom(root, path) {
  return readFileSync(join(root, path), 'utf8');
}

function textFromPath(path) {
  return readFileSync(path, 'utf8');
}

function installMem0Stub(root) {
  const moduleDir = join(root, 'mem0');
  mkdirSync(moduleDir, { recursive: true });
  writeFileSync(
    join(moduleDir, '__init__.py'),
    `
import json
from pathlib import Path


class Memory:
    def __init__(self, config):
        self.config = config
        self.root = Path(config["history_db_path"]).parent
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / "stub-config.json").write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")

    @classmethod
    def from_config(cls, config):
        return cls(config)

    def add(self, messages, *, user_id=None, agent_id=None, run_id=None, metadata=None, infer=True):
        entry = {
            "messages": messages,
            "user_id": user_id,
            "agent_id": agent_id,
            "run_id": run_id,
            "metadata": metadata,
            "infer": infer,
        }
        with (self.root / "stub-adds.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\\n")
        return {"results": [{"id": "add-1", "memory": "stored character memory", "event": "ADD"}]}

    def search(self, query, *, filters=None, top_k=20, threshold=0.1):
        entry = {"query": query, "filters": filters, "top_k": top_k, "threshold": threshold}
        with (self.root / "stub-searches.jsonl").open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\\n")
        return {"results": [{"id": "search-1", "memory": "Lynn promised to remember tea", "score": 0.91}]}

    def get_all(self, *, filters=None, top_k=20):
        return {"results": [{"id": "startup-1", "memory": "Lynn knows the user likes quiet tea"}]}
`,
    'utf8',
  );
}
