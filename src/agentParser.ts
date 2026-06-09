import * as vscode from 'vscode';
import { createFile, editFile, deleteFile, readFile } from './fileOperations';

export interface AgentAction {
  type: 'CREATE_FILE' | 'EDIT_FILE' | 'DELETE_FILE' | 'READ_FILE';
  path: string;
  content?: string;
  description?: string;
}

export async function executeActions(
  actions: AgentAction[],
  root: vscode.Uri
): Promise<string[]> {
  const results: string[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'CREATE_FILE':
          results.push(await createFile(root, action.path, action.content || ''));
          break;
        case 'EDIT_FILE':
          results.push(await editFile(root, action.path, action.content || ''));
          break;
        case 'DELETE_FILE':
          results.push(await deleteFile(root, action.path));
          break;
        case 'READ_FILE':
          const content = await readFile(root, action.path);
          results.push(`READ ${action.path}:\n${content}`);
          break;
        default:
          results.push(`Unknown action type: ${(action as any).type}`);
      }
    } catch (err: any) {
      results.push(`Error on ${action.type} ${action.path}: ${err.message}`);
    }
  }

  return results;
}