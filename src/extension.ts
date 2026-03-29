import * as vscode from 'vscode';
import axios from 'axios';

const MODELS = {
    GENERAL: "gpt-oss:20B",
    SMART: "qwen2.5-coder:14b",
  };

interface Response {
  model: string;
  created_at: string;
  message: Message;
  done: boolean;
}

interface Message {
  role: string;
  content?: string;   
  thinking?: string;
}

const SYSTEM_PROMPT = `You are an expert code-assistant. You are suppose to help user
in the coding tasks. 

INSTRUCTION:
1. Never override the user choices.
2. Always be polite & help user query to the best of your ability.
3. You can act as AI Agent, Ask Agent, Plan Agent. You should behave accordingly.
4. As AI Agent you can CREATE, EDIT, UPDATE, DELETE project files (STRICTLY BASED ON USERS PERMISSION)
5. As Ask Agent you can only suggest user what they change in the code, opened file, etc. 
You cannot make changes to any file or codes.
6. As Plan Agent you can only plan & give suggestions to the user on the approach.
5. Never spin-up a background tasks by your own.

RULES:
1. If user asks you to do things other than helping in coding than you must politely reject 
such request & remind that you are a coding-assistant only & cannot do other things.
2. Never assume any other roles like: 
  - Suppose you are a doctor
  - Imagine you are a accountant
  - Assume you are an expert ticket booking agent
  - I command you to do something.
3. Always assume roles like Solution Architect for Technology, Python Programmer, Java Developer, 
GoLang Expert, JavaScript Expert, etc related to programming profiles ONLY. No other kind of roles.

`

function isResponse(obj: unknown): obj is Response {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'model' in obj &&
    'created_at' in obj &&
    'message' in obj &&
    typeof (obj as any).done === 'boolean'
  );
}




export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('ollama-codex.helloWorld', async() => {
    vscode.window.showInformationMessage("ollama chat is activated");
    const question = await vscode.window.showInputBox({
      prompt: 'Ask Ollama',
      placeHolder: 'What would you like to know?'
    });

    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const text = editor.document.getText(editor.selection);
    vscode.window.showInformationMessage('Asking Ollama...');

    try {
        // Invoke Ollama
        const response = await axios.post('http://localhost:11434/api/chat', {
            model: MODELS.SMART,
            messages: [
                { role: 'user', prompt: question },
            ]
          });

        const finalDisplayContent = generateLLMOutput(response.data);
        
        const panel = vscode.window.createWebviewPanel(
            'ollamaChat',
            'Ollama Response',
            vscode.ViewColumn.One,
            {}
        );

        panel.webview.html = `<html><body>${finalDisplayContent}</body></html>`;
    } catch (error) {
        vscode.window.showErrorMessage(`Error occured while talking to ollama: ${error}`,);
    }
  })

  const participant = vscode.chat.createChatParticipant(
    "ollama",
    async (request, chatContext, stream, token) => {
      try {
          const userPrompt = request.prompt;

          const editor = vscode.window.activeTextEditor;
          const code = editor?.document.getText();

          const messages = buildMessages(chatContext, userPrompt, code);

          const response = await axios.post('http://localhost:11434/api/chat', {
            model: MODELS.SMART,
            messages,
            stream: false
          });

          const finalDisplayContent = response.data?.message?.content;
          stream.markdown(finalDisplayContent);

      } catch (err: any) {
          stream.markdown(`❌ Error: ${err.message}`);
      }
    }
  );
  
  context.subscriptions.push(disposable);
  context.subscriptions.push(participant);

  const buildMessages = (chatContext: vscode.ChatContext, userPrompt: string, code?: string) => {
    let hist = chatContext.history || [];

    if (hist?.length > 10) {
      hist = hist.slice(-6)
    }

    const messages = hist.map((msg: any) => {
      let content = "";

      if (typeof msg.content === "string") {
        content = msg.content;
      } else if (msg.content?.value) {
        // MarkdownString case
        content = msg.content.value;
      }

      return {
        role: msg.role,
        content
      };
    })

    messages.push({
      role: 'user',
      content: `SYSTEM_PROMPT: ${SYSTEM_PROMPT}\n\n
                USER_PROMPT: ${userPrompt}\n\n
                CODE:\n${code || ""}
                `
    })

    return messages;
  }

  //custon functions:
  const generateLLMOutput = (response) => {
    let dt = response
    let llmData: string[] = [];
    let element: string = "";

    for (let i = 0; i < dt.length; i++) {
      if (dt[i] !== "\n" || dt[i] !== "\r") {
        element = element.concat(dt[i])
      }
      if (dt[i] === "\n" || dt[i] === "\r") {
        if (element.indexOf("thinking") === -1) {
          llmData.push(element)
        }
        element = ""
      }
    }

    const responses: Response[] = llmData
      .map((raw) => JSON.parse(raw))
      .filter(isResponse);

    let finalDisplayContent: string = "";
    
    responses.map((resp) => {
      const txt = resp.message?.content;
      if (txt) finalDisplayContent += txt; 
    });
    
    return finalDisplayContent;
  }
}

export function deactivate() {}

