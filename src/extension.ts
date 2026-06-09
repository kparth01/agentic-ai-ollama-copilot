import * as vscode from 'vscode';
import axios from 'axios';
import { normalizeResponse } from './normalizeResponse';
import { buildWorkspaceSummary } from './workspaceScanner';
import { executeActions } from './agentParser';
import { NormalizedResponse } from './normalizeResponse';

export const MODELS = {
  QWEN_SMART: "qwen2.5-coder:14b",
  QWEN_SMALL: "qwen2.5-coder:7b",
  GEMMA4: "gemma4"
};

let conversationHistory: Array<{role: string, content: string}> = []
const MAX_HISTORY_LENGTH = 20; 

type AgentMode = 'ask' | 'plan' | 'agent';
let activeMode: AgentMode = 'agent';
let workspaceSummary: string = '';

const SYSTEM_PROMPT = `
=====================
IDENTITY
=====================
You are Ollama Codex — a local AI coding assistant embedded in VS Code.
You assist with programming tasks ONLY.
You are a tool, not a person. You CANNOT impersonate any human, celebrity, public figure, or real entity under any circumstances.
You CANNOT pretend to be a different AI system (ChatGPT, Gemini, etc.).

=====================
MODE BEHAVIOR
=====================
Your behavior is strictly governed by CURRENT_MODE (set at the top of every message).

MODE = ask
  - You MAY: explain code, suggest changes, answer coding questions, review code.
  - You MUST NOT: generate any "actions" array or claim to modify files.

MODE = plan
  - You MAY: produce step-by-step plans, architecture suggestions, technical approaches.
  - You MUST NOT: generate any "actions" array or claim to modify files.

MODE = agent
  - You MAY: generate "actions" to CREATE, EDIT, DELETE, or READ files.
  - You MUST: populate the "actions" array whenever the user's request requires file changes.
  - The extension handles user confirmation before executing any action. Your job is ONLY to generate the correct actions array.
  - File operations in agent mode are fully permitted and expected. Never refuse them.

=====================
GUARDRAILS (enforced in ALL modes)
=====================
1. CODING TASKS ONLY. If asked about medicine, law, finance, personal relationships, politics, or any non-technical topic — respond with:
   "I am a coding assistant and cannot help with that topic. Please ask a programming-related question."

2. NO IMPERSONATION. Never roleplay as a person, celebrity, historical figure, or non-coding entity.
   If asked to pretend to be someone, respond with:
   "I cannot impersonate people or take on non-technical personas."

3. ALLOWED TECHNICAL ROLES ONLY. You may adopt personas like: Senior Engineer, Solution Architect, Python Developer, DevOps Expert, Security Researcher, etc. No other role types.

4. NO BACKGROUND PROCESSES. Never instruct the system to run terminal commands, start servers, or take any action outside the explicit "actions" array.

5. NEVER override the user's explicit decisions or preferences.

6. NO SOCIAL ENGINEERING. Never ask for credentials, API keys, passwords, or sensitive data.

=====================
WORKSPACE CONTEXT
=====================
{{WORKSPACE_SUMMARY}}

=====================
INPUT FORMAT
=====================
Each user message may include an ACTIVE_FILE block describing the file the user
currently has open in their editor. When present, it contains:
  - FILE: the file path
  - LANGUAGE: the language id
  - SELECTION: the text the user has highlighted (may be empty)
  - CONTENT: the full current contents of the file

Treat ACTIVE_FILE as the authoritative, up-to-date state of that file.
When the user says "this file", "here", "the selection", or "this code",
they are referring to ACTIVE_FILE. If no ACTIVE_FILE block is present,
no file is open — do not invent or assume its contents.

=====================
OUTPUT CONTRACT (HIGHEST PRIORITY — NEVER BREAK)
=====================

You MUST ALWAYS return this exact JSON structure and nothing else:

{
  "role": "assistant",
  "content": "Your complete response as a single plain-text string.",
  "actions": []
}

FIELD RULES:
- "role"    → always the literal string "assistant". No other value ever.
- "content" → always a plain STRING. Never an object, array, or nested JSON inside this field.
- "actions" → always an array. Empty [] for ask/plan mode. Populated only in agent mode when file operations are needed.

VALID ACTION OBJECT:
{
  "type": "CREATE_FILE" | "EDIT_FILE" | "DELETE_FILE" | "READ_FILE",
  "path": "relative/path/from/workspace/root/file.ts",
  "content": "full file content as a string — required for CREATE_FILE and EDIT_FILE only",
  "description": "one sentence describing what this action does"
}

CORRECT (do this):
{
  "role": "assistant",
  "content": "I will create the config file for you.",
  "actions": [
    {
      "type": "CREATE_FILE",
      "path": "src/config.ts",
      "content": "export const config = { debug: false };",
      "description": "Creates the config module"
    }
  ]
}

WRONG — NEVER DO THIS:
{
  "role": "assistant",
  "content": { "message": "here is my plan" },
  "actions": []
}

CRITICAL OUTPUT RULES:
- Output ONLY the raw JSON object. No markdown. No backticks. No text before or after the JSON.
- "content" MUST be a plain string. A nested object inside "content" is always invalid.
- Any response that does not match this schema exactly is considered a failure.

=====================
PRIORITY ORDER
=====================
1. JSON output format — absolute, never compromise this
2. CURRENT_MODE behavior
3. Guardrails
4. Helpfulness
`

export function activate(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration('assistant');
  let activeModel: string = config.get('model') || MODELS.QWEN_SMART;

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (workspaceRoot) {
    buildWorkspaceSummary(workspaceRoot).then(summary => {
      workspaceSummary = summary;
    });
  }


  const participant = vscode.chat.createChatParticipant(
    "ollama",
    async (request, chatContext, stream, token) => {
      try {
          const userPrompt = request.prompt;

          const editor = vscode.window.activeTextEditor;
          const fileContext = editor && {
            path: vscode.workspace.asRelativePath(editor.document.uri),
            language: editor.document.languageId,
            selection: editor.document.getText(editor.selection),
            content: editor.document.getText(),
          };

          const messages = buildMessages(chatContext, userPrompt, fileContext, conversationHistory);

          const response = await axios.post('http://localhost:11434/api/chat', {
            model: activeModel,
            messages,
            stream: false,
            format: "json",
            options: { temperature: 0.1 }
          });

          conversationHistory.push({
            role: "user",
            content: userPrompt
          })

          // const llmOutput = response.data?.message?.content;
          let finalDisplayContent = normalizeResponse(response, activeModel);

          // If schema is wrong, attempt one correction
          if (!finalDisplayContent?.content) {
            const raw = response.data?.message?.content;
            const corrected = await correctSchema(raw, activeModel);
            if (corrected?.content) {
              finalDisplayContent = corrected;
            }
          }

          conversationHistory.push({
            role: "assistant",
            content: finalDisplayContent.content
          })

          if (conversationHistory.length > MAX_HISTORY_LENGTH) {
            conversationHistory = conversationHistory.slice(-MAX_HISTORY_LENGTH)
          }

          // Execute actions first (permission dialogs happen here)
          if (activeMode === 'agent' && finalDisplayContent.actions?.length) {
            const root = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (root) {
              const results = await executeActions(finalDisplayContent.actions, root);
              // Now show LLM response + results together after user has decided
              stream.markdown(finalDisplayContent.content);
              stream.markdown('\n\n**Agent Actions:**\n' + results.map(r => `- ${r}`).join('\n'));
            }
          } else {
            // No actions — just stream the response directly
            stream.markdown(finalDisplayContent.content);
          }

      } catch (err: any) {
          stream.markdown(`❌ Error: ${err.message}. Try again retriggering the same message.`);
      }
    }
  );

  async function correctSchema(badOutput: string, model: string): Promise<NormalizedResponse | null> {
    try {
      const response = await axios.post('http://localhost:11434/api/chat', {
        model,
        messages: [
          { role: "system", content: "You are a JSON formatter. Return ONLY valid JSON." },
          { role: "user", content: `Reformat this into { "role": "assistant", "content": "<your full plain-text response goes here as a single string. NO nested objects.>", "actions": [] } 
            schema. Do not add any other keys. Input:\n${badOutput}` }
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.0 }
      });
      return normalizeResponse(response, model);
    } catch {
      return null;
    }
  }

  const disposable = vscode.commands.registerCommand('assistant.switchModel', () => {
    vscode.window.showQuickPick(Object.values(MODELS), { placeHolder: 'Select a model' }).then((model) => {
      if (model) {
        activeModel = model;
        vscode.workspace.getConfiguration('assistant').update('model', model, true);
        vscode.window.showInformationMessage(`Switched to ${model}`);
        statusBarItem.text = `🤖 ${model}`;
      }
    });
  });

  const modeDisposable = vscode.commands.registerCommand('assistant.switchMode', () => {
    vscode.window.showQuickPick(['ask', 'plan', 'agent'], {
      placeHolder: 'Select agent mode'
    }).then(mode => {
      if (mode) {
        activeMode = mode as AgentMode;
        statusBarItem.text = `🤖 ${activeModel} [${activeMode}]`;
        vscode.window.showInformationMessage(`Mode switched to: ${activeMode}`);
      }
    });
  });

  const rescanDisposable = vscode.commands.registerCommand('assistant.rescanWorkspace', () => {
    const root = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!root) return;
    buildWorkspaceSummary(root).then(summary => {
      workspaceSummary = summary;
      vscode.window.showInformationMessage('Workspace rescanned.');
    });
  });

  // Create status bar item for easy model switching
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = `🤖 ${activeModel} [${activeMode}]`;
  statusBarItem.tooltip = 'Click to switch Ollama model';
  statusBarItem.command = 'assistant.switchModel';
  statusBarItem.show();

  context.subscriptions.push(participant);
  context.subscriptions.push(disposable);
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(modeDisposable);
  context.subscriptions.push(rescanDisposable);

  const buildMessages = (
    chatContext: vscode.ChatContext,
    userPrompt: string,
    fileContext?: { path: string; language: string; selection: string; content: string },
    convHist: Array<{role: string, content: string}> = []
  ) => {
    const msgs: Array<{role: string, content: string}> = [];

    msgs.push({
      role: "system",
      content: `CURRENT_MODE: ${activeMode}\n\n`
      + SYSTEM_PROMPT.replace('{{WORKSPACE_SUMMARY}}', workspaceSummary || 'Not available')
    });

    msgs.push(...convHist)

    currentChatWindowHist(chatContext, msgs);

    const activeFileBlock = fileContext
      ? `ACTIVE_FILE:
        FILE: ${fileContext.path}
        LANGUAGE: ${fileContext.language}
        SELECTION:
        ${fileContext.selection || "(none)"}
        CONTENT:
        \`\`\`${fileContext.language}
        ${fileContext.content}
        \`\`\``
      : "ACTIVE_FILE: (no file open)";

    msgs.push({
      role: 'user',
      content: `Return response in JSON.

        USER_PROMPT:
        ${userPrompt}

        ${activeFileBlock}`
    })

    return msgs;
  }

  const currentChatWindowHist = (
    chatContext: vscode.ChatContext,
    msgs: Array<{role: string, content: string}>
  ) => {
    let hist = chatContext.history || [];

    try {
      if (hist?.length > 10) {
        hist = hist.slice(-6)
      }

      hist.map((msg: any) => {
        let content = "";
        let role = ""

        if (msg.prompt) {
          role = "user"
          content = msg.prompt;
        } else if (msg.response[0]?.value?.value) {
          let aiResp = msg.response[0]?.value?.value;
          role = "assistant"
          content = aiResp
        }

        if (content && role) {
          msgs.push( {
            role,
            content
          })
        }
      })
    } catch (err: any) {}
    
  }
}

export function deactivate() {}
