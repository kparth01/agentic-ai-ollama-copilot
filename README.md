# Ollama Codex Extension for Visual Studio Code

## Overview

The **Ollama Codex** extension integrates an AI-powered coding assistant directly into Visual Studio Code. It leverages the capabilities of Ollama's language models to help users with coding tasks, provide explanations, and even generate code snippets.

## Features

- **Ask Ollama**: Users can pose questions or request assistance directly from within VSCode.
- **Integrated Chat**: The extension provides a webview panel where you can view responses from the AI model.
- **Contextual Code Analysis**: When you select code in the editor, the selected text is sent to the AI for analysis and suggestions.
- **Dynamic Responses**: The extension dynamically generates responses based on your prompts and the selected code.

## Getting Started

1. **Install the Extension**:
   - Open Visual Studio Code.
   - Go to the Extensions view by clicking on the square icon on the Sidebar or pressing `Ctrl+Shift+X`.
   - Search for "Ollama Codex".
   - Click on 'Install' next to the extension.

2. **Configure Ollama Server**:
   - Ensure that you have an instance of Ollama running on your local machine.
   - The default endpoint is set to `http://localhost:11434/api/chat`. If your server runs on a different port or host, update the code accordingly.

3. **Activate the Extension**:
   - Open any project in VSCode.
   - Press `Ctrl+Shift+P` to open the Command Palette.
   - Type and select "ollama-codex.helloWorld" to activate the extension.

## Usage

- **Ask Ollama**: 
  - Use the command palette (`Ctrl+Shift+P`) and type "Ask Ollama".
  - Enter your question or coding-related prompt in the input box.
  
- **Code Analysis**:
  - Select any piece of code in the editor.
  - The selected text will be automatically sent to the AI for analysis.
  
## Customization

The extension can be further customized by modifying the `MODELS` object and adjusting the `SYSTEM_PROMPT` to better fit your needs.

## Demo

![Demo](./demo.gif)

## Contributing

We welcome contributions! If you have any suggestions, bug reports, or would like to enhance the functionality of this extension, please open an issue on our [GitHub repository](https://github.com/kparth01/agentic-ai-ollama-copilot.git).

## License

[MIT](./LICENSE) License © 2026-PRESENT [Parth Kansara](https://github.com/kparth01)

---

Feel free to reach out if you have any questions or need further assistance!
