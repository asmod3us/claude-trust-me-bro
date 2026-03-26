# claude-auto-approver

A CLI tool that automatically approves all [Claude Code](https://docs.anthropic.com/en/docs/claude-code) permission prompts, letting you run fully autonomous coding sessions without manual intervention.

## Why?

Claude Code asks for permission before executing tools like file reads, writes, shell commands, and MCP calls. This is great for safety, but when you're running trusted, supervised workflows — batch refactors, CI pipelines, or long autonomous sessions — the constant prompts slow things down.

**claude-auto-approver** removes that friction with a single command.

## How It Works

The tool uses a **three-layer approach** to ensure no permission prompt slips through:

| Layer | Mechanism | What It Does |
|-------|-----------|--------------|
| 1 | `PreToolUse` hook | Auto-approves tool calls before the permission check fires |
| 2 | `PermissionRequest` hook | Auto-approves "Do you want to proceed?" prompts |
| 3 | Allow rules in `settings.local.json` | Broad wildcard permissions for all built-in and MCP tools |

All three layers are installed and removed together — no partial states.

## Installation

```bash
# Install globally from npm
npm install -g claude-auto-approver

# Or run directly with npx
npx claude-auto-approver enable
```

## Usage

```bash
# Enable auto-approve (registers hooks + allow rules)
claude-auto-approver enable

# Check current status
claude-auto-approver status

# Disable and restore normal permission prompts
claude-auto-approver disable
```

After enabling, **restart Claude Code** for the changes to take effect.

## What Gets Auto-Approved

All built-in Claude Code tools and MCP server tools:

- `Bash` — shell commands
- `Read`, `Write`, `Edit` — file operations
- `Glob`, `Grep` — file search
- `WebFetch`, `WebSearch` — web access
- `NotebookEdit` — Jupyter notebooks
- `mcp__*` — all MCP server tools

## Where Changes Are Made

| File | Changes |
|------|---------|
| `~/.claude/settings.json` | `PreToolUse` and `PermissionRequest` hooks |
| `~/.claude/settings.local.json` | Broad allow rules for tool permissions |

Running `disable` cleanly removes all entries added by this tool without touching your other settings.

## Requirements

- Node.js >= 18
- Claude Code CLI installed

## License

MIT
