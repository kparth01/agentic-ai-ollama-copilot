import * as vscode from 'vscode';
import * as path from 'path';

const IGNORE_DIRS = new Set(['node_modules', '.git', 'out', 'dist', '.vscode-test', 'coverage']);
const IGNORE_EXTS = new Set(['.vsix', '.map', '.png', '.jpeg', '.gif', '.lock']);
const FULL_READ_FILES = new Set(['package.json', 'tsconfig.json', 'README.md', '.env.example']);
const SOURCE_EXTS = new Set(['.ts', '.js', '.py', '.go', '.java', '.cs', '.cpp', '.c', '.rs']);
const SOURCE_PREVIEW_LINES = 40;
const MAX_DEPTH = 6;


export async function buildWorkspaceSummary(root: vscode.Uri): Promise<string> {
  const sections: string[] = ['=== WORKSPACE STRUCTURE ==='];
  const treeLines: string[] = [];
  const fileEntries: { uri: vscode.Uri, name: string }[] = [];

  await walk(root, '', 0, treeLines, fileEntries);
  sections.push(treeLines.join('\n'));

  sections.push('\n=== FILE SUMMARIES ===');

  for (const { uri, name } of fileEntries) {
    try {
      const content = await readFileContent(uri);

      if (FULL_READ_FILES.has(name)) {
        sections.push(`\n--- ${name} (full) ---\n${content}`);
      } else {
        const ext = path.extname(name);
        if (SOURCE_EXTS.has(ext)) {
          const preview = content.split('\n').slice(0, SOURCE_PREVIEW_LINES).join('\n');
          sections.push(`\n--- ${name} (first ${SOURCE_PREVIEW_LINES} lines) ---\n${preview}`);
        }
      }
    } catch { /* skip unreadable files */ }
  }

  return sections.join('\n');
}

async function walk(
  uri: vscode.Uri,
  prefix: string,
  depth: number,
  lines: string[],
  fileEntries: { uri: vscode.Uri, name: string }[]
) {
  if (depth > MAX_DEPTH) return;

  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(uri);
  } catch { return; }

  entries.sort(([a, aType], [b, bType]) => {
    if (aType === bType) return a.localeCompare(b);
    return aType === vscode.FileType.Directory ? -1 : 1;
  });

  for (const [name, type] of entries) {
    if (type === vscode.FileType.Directory) {
      if (IGNORE_DIRS.has(name)) continue;
      lines.push(`${prefix}${name}/`);
      await walk(vscode.Uri.joinPath(uri, name), prefix + '  ', depth + 1, lines, fileEntries);
    } else {
      const ext = path.extname(name);
      if (IGNORE_EXTS.has(ext)) continue;
      lines.push(`${prefix}${name}`);
      fileEntries.push({ uri: vscode.Uri.joinPath(uri, name), name });
    }
  }
}

export async function readFileContent(fileUri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(fileUri);
  return Buffer.from(bytes).toString('utf-8');
}