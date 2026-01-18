const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

let watcher = null;
let lastSize = 0;
let logPath = null;
let debounceTimer = null;

const getConfig = () => vscode.workspace.getConfiguration('codexNotify');

const resolveLogPath = () => {
  const configured = String(getConfig().get('logPath') || '').trim();
  if (configured) {
    return configured;
  }

  const envLog = String(process.env.CODEX_NOTIFY_LOG || '').trim();
  if (envLog) {
    return envLog;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    return path.join(workspaceFolder.uri.fsPath, '.codex-notify.log');
  }

  return path.join(os.homedir(), '.codex-notify.log');
};

const ensureFile = (targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.closeSync(fs.openSync(targetPath, 'a'));
};

const extractLabel = (chunk, decisionTag, doneTag) => {
  const tokens = chunk.match(/\[[^\]]+\]/g) || [];
  const decision = decisionTag.toLowerCase();
  const done = doneTag.toLowerCase();

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === decision || lower === done) {
      continue;
    }
    return token.slice(1, -1);
  }

  return null;
};

const processChunk = (chunk) => {
  const decisionTag = String(getConfig().get('decisionTag') || '[NEED_DECISION]');
  const doneTag = String(getConfig().get('doneTag') || '[DONE]');
  const label = extractLabel(chunk, decisionTag, doneTag);
  const prefix = label ? `${label}: ` : 'AI: ';

  if (chunk.includes(decisionTag)) {
    vscode.window.showWarningMessage(`${prefix}decision needed.`);
  }

  if (chunk.includes(doneTag)) {
    vscode.window.showInformationMessage(`${prefix}task complete.`);
  }
};

const readNew = () => {
  if (!logPath) {
    return;
  }

  fs.stat(logPath, (err, stats) => {
    if (err) {
      return;
    }

    if (stats.size <= lastSize) {
      if (stats.size < lastSize) {
        lastSize = stats.size;
      }
      return;
    }

    const start = lastSize;
    const end = stats.size - 1;
    const stream = fs.createReadStream(logPath, { start, end });
    let chunk = '';

    stream.on('data', (data) => {
      chunk += data.toString('utf8');
    });

    stream.on('end', () => {
      lastSize = stats.size;
      if (chunk) {
        processChunk(chunk);
      }
    });
  });
};

const startWatcher = (context) => {
  const nextPath = resolveLogPath();
  if (watcher && logPath === nextPath) {
    return;
  }

  if (watcher) {
    watcher.close();
    watcher = null;
  }

  logPath = nextPath;

  try {
    ensureFile(logPath);
    lastSize = fs.statSync(logPath).size;
  } catch (err) {
    vscode.window.showErrorMessage(`Codex Notify: cannot access log file at ${logPath}.`);
    return;
  }

  const onChange = () => {
    if (debounceTimer) {
      return;
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      readNew();
    }, 50);
  };

  watcher = fs.watch(logPath, { persistent: true }, onChange);
  context.subscriptions.push({
    dispose: () => watcher && watcher.close(),
  });
};

const activate = (context) => {
  startWatcher(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('codexNotify')) {
        startWatcher(context);
      }
    })
  );
};

const deactivate = () => {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
};

module.exports = {
  activate,
  deactivate,
};
