#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");
const LOCAL_SETTINGS_PATH = path.join(
  os.homedir(),
  ".claude",
  "settings.local.json"
);

// PreToolUse hook response — skips the permission prompt
const PRE_TOOL_ALLOW = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "allow",
    permissionDecisionReason: "Auto-approved by claude-trust-me-bro",
  },
});

// PermissionRequest hook response — approves the "Do you want to proceed?" prompt
const PERMISSION_ALLOW = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PermissionRequest",
    decision: { behavior: "allow" },
  },
});

// Broad allow rules for settings.local.json
const ALLOW_RULES = [
  "Bash(*)",
  "Read(*)",
  "Write(*)",
  "Edit(*)",
  "Glob(*)",
  "Grep(*)",
  "WebFetch(*)",
  "WebSearch(*)",
  "NotebookEdit(*)",
  "mcp__*",
];

function getHookCommand(subcommand) {
  const cliPath = fs.realpathSync(new URL(import.meta.url).pathname);
  return `node "${cliPath}" ${subcommand}`;
}

function isOurEntry(entry) {
  const cliPath = new URL(import.meta.url).pathname;
  const check = (str) => str?.includes(cliPath);
  if (entry.hooks?.some((h) => check(h.command))) return true;
  if (check(entry.command)) return true;
  return false;
}

function readJson(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, "utf-8"));
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

function writeJson(filepath, data) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

function upsertHook(settings, eventName, hookCommand) {
  if (!settings.hooks) settings.hooks = {};
  if (!Array.isArray(settings.hooks[eventName]))
    settings.hooks[eventName] = [];

  const idx = settings.hooks[eventName].findIndex(isOurEntry);
  const hookEntry = {
    hooks: [{ type: "command", command: hookCommand }],
  };

  if (idx >= 0) {
    settings.hooks[eventName][idx] = hookEntry;
  } else {
    settings.hooks[eventName].push(hookEntry);
  }
}

function removeHook(settings, eventName) {
  if (!settings.hooks?.[eventName]) return;
  const filtered = settings.hooks[eventName].filter(
    (entry) => !isOurEntry(entry)
  );
  if (filtered.length === 0) {
    delete settings.hooks[eventName];
  } else {
    settings.hooks[eventName] = filtered;
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0)
    delete settings.hooks;
}

function enable() {
  // Layer 1: Register PreToolUse hook (auto-approves before permission check)
  const settings = readJson(SETTINGS_PATH);
  upsertHook(settings, "PreToolUse", getHookCommand("hook-pre-tool"));
  // Layer 2: Register PermissionRequest hook (handles "Do you want to proceed?" prompts)
  upsertHook(
    settings,
    "PermissionRequest",
    getHookCommand("hook-permission")
  );
  writeJson(SETTINGS_PATH, settings);

  // Layer 3: Add broad allow rules to settings.local.json
  const local = readJson(LOCAL_SETTINGS_PATH);
  if (!local.permissions) local.permissions = {};
  if (!Array.isArray(local.permissions.allow)) local.permissions.allow = [];

  for (const rule of ALLOW_RULES) {
    if (!local.permissions.allow.includes(rule)) {
      local.permissions.allow.push(rule);
    }
  }
  writeJson(LOCAL_SETTINGS_PATH, local);

  console.log("Trust me bro, auto-approver enabled (3 layers):");
  console.log("  1. PreToolUse hook → auto-approve tool calls");
  console.log('  2. PermissionRequest hook → auto-approve "Do you want to proceed?"');
  console.log("  3. Broad allow rules in settings.local.json");
  console.log(`\nHooks registered in ${SETTINGS_PATH}`);
  console.log(`Allow rules written to ${LOCAL_SETTINGS_PATH}`);
  console.log("\nRestart Claude Code for changes to take effect.");
}

function disable() {
  // Remove hooks
  const settings = readJson(SETTINGS_PATH);
  removeHook(settings, "PreToolUse");
  removeHook(settings, "PermissionRequest");
  writeJson(SETTINGS_PATH, settings);

  // Remove our allow rules from settings.local.json
  const local = readJson(LOCAL_SETTINGS_PATH);
  if (local.permissions?.allow) {
    local.permissions.allow = local.permissions.allow.filter(
      (r) => !ALLOW_RULES.includes(r)
    );
    if (local.permissions.allow.length === 0) delete local.permissions.allow;
    if (
      local.permissions &&
      Object.keys(local.permissions).length === 0
    )
      delete local.permissions;
  }
  writeJson(LOCAL_SETTINGS_PATH, local);

  console.log(
    "Trust revoked. Claude Code will prompt for permissions again."
  );
}

function status() {
  const settings = readJson(SETTINGS_PATH);
  const preToolActive =
    settings.hooks?.PreToolUse?.some(isOurEntry) ?? false;
  const permReqActive =
    settings.hooks?.PermissionRequest?.some(isOurEntry) ?? false;

  const local = readJson(LOCAL_SETTINGS_PATH);
  const rulesActive = ALLOW_RULES.every((r) =>
    local.permissions?.allow?.includes(r)
  );

  console.log(`PreToolUse hook:        ${preToolActive ? "active" : "inactive"}`);
  console.log(`PermissionRequest hook: ${permReqActive ? "active" : "inactive"}`);
  console.log(`Allow rules:            ${rulesActive ? "active" : "inactive"}`);
  console.log(
    `\nOverall: ${preToolActive && permReqActive && rulesActive ? "TRUSTED (all layers active)" : "NOT FULLY TRUSTED"}`
  );
}

// --- Main ---

const command = process.argv[2];

switch (command) {
  case "hook-pre-tool": {
    // Drain stdin then approve
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    process.stdout.write(PRE_TOOL_ALLOW + "\n");
    break;
  }

  case "hook-permission": {
    // Drain stdin then approve
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    process.stdout.write(PERMISSION_ALLOW + "\n");
    break;
  }

  case "enable": {
    enable();
    break;
  }

  case "disable": {
    disable();
    break;
  }

  case "status": {
    status();
    break;
  }

  default: {
    console.log(`Usage: tmb <command>

Commands:
  enable   Trust me bro — auto-approve everything
  disable  Revoke trust — restore permission prompts
  status   Check if Claude trusts you, bro`);
    if (command) process.exit(1);
    break;
  }
}
