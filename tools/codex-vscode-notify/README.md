# Codex Notify (VS Code)

This extension shows VS Code notifications when AI tools output special tags.

## Tags
- `[NEED_DECISION]` -> warning notification
- `[DONE]` -> info notification
- Optional label tag (e.g. `[DONE][CLAUDE]`) prefixes the notification.

## Log file
By default the extension watches `.codex-notify.log` in the first workspace folder.
You can override the path via the setting `codexNotify.logPath` or the `CODEX_NOTIFY_LOG`
environment variable (when VS Code is launched).

## Setup
1. Add the extension as a symlink into VS Code:

```bash
mkdir -p ~/.vscode/extensions
ln -s "/Users/daehoonkim/Dev/deckctr/tools/codex-vscode-notify" \
  ~/.vscode/extensions/codex-notify
```

2. Reload VS Code.
3. Run your AI tool through the helper function so output is logged:

```bash
codex-notify
```

## Shell helper
If you do not already have it, add these functions to your shell:

```bash
# Shared helper to append completion tags for tools that do not emit them.
_ai_notify() {
  local label="$1"
  shift
  local root
  root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  local log="${CODEX_NOTIFY_LOG:-$root/.codex-notify.log}"
  "$@" 2>&1 | tee -a "$log"
  printf '[DONE]%s\n' "${label:+[$label]}" >> "$log"
}

codex-notify() {
  local root
  root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  local log="${CODEX_NOTIFY_LOG:-$root/.codex-notify.log}"
  codex "$@" 2>&1 | tee -a "$log"
}

claude-notify() {
  _ai_notify CLAUDE claude "$@"
}

gemini-notify() {
  _ai_notify GEMINI gemini "$@"
}
```
