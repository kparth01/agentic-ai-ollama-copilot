import * as vscode from 'vscode';

async function confirm(message: string): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(message, 'Allow', 'Deny');
  return choice === 'Allow';
}

export async function createFile(root: vscode.Uri, relativePath: string, content: string): Promise<string> {
  const uri = vscode.Uri.joinPath(root, relativePath);
  const allowed = await confirm(`Ollama wants to CREATE: ${relativePath}`);
  if (!allowed) return `Skipped: user denied CREATE for ${relativePath}`;
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
  return `Created: ${relativePath}`;
}

export async function editFile(root: vscode.Uri, relativePath: string, content: string): Promise<string> {
  const uri = vscode.Uri.joinPath(root, relativePath);
  const allowed = await confirm(`Ollama wants to EDIT: ${relativePath}`);
  if (!allowed) return `Skipped: user denied EDIT for ${relativePath}`;
  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
  return `Edited: ${relativePath}`;
}

export async function deleteFile(root: vscode.Uri, relativePath: string): Promise<string> {
  const uri = vscode.Uri.joinPath(root, relativePath);
  const allowed = await confirm(`Ollama wants to DELETE: ${relativePath}. This cannot be undone.`);
  if (!allowed) return `Skipped: user denied DELETE for ${relativePath}`;
  await vscode.workspace.fs.delete(uri, { recursive: false });
  return `Deleted: ${relativePath}`;
}

export async function readFile(root: vscode.Uri, relativePath: string): Promise<string> {
  const uri = vscode.Uri.joinPath(root, relativePath);
  const bytes = await vscode.workspace.fs.readFile(uri);
  return Buffer.from(bytes).toString('utf-8');
}