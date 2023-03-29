"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const https = require("https");
class ChatPanel {
    static createOrShow(extensionUri, apiKey) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            ChatPanel.currentPanel._apiKey = apiKey;
            ChatPanel.currentPanel.postMessage({ type: 'apiKeyUpdated', apiKey });
            return;
        }
        const panel = vscode.window.createWebviewPanel(ChatPanel.viewType, 'Optimun Code GPT - Chat', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        });
        ChatPanel.currentPanel = new ChatPanel(panel, apiKey);
    }
    static revive(panel, extensionUri, apiKey) {
        ChatPanel.currentPanel = new ChatPanel(panel, apiKey);
    }
    constructor(panel, apiKey) {
        this._disposables = [];
        this._panel = panel;
        this._apiKey = apiKey;
        this._update();
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'apiKeyUpdated':
                    this._apiKey = message.apiKey;
                    break;
                case 'generateCode':
                    this._generateCode(message.prompt);
                    break;
            }
        }, undefined, this._disposables);
        // Dispose the panel when the user closes it
        this._panel.onDidDispose(() => {
            ChatPanel.currentPanel = undefined;
            this.dispose();
        }, null, this._disposables);
    }
    dispose() {
        ChatPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
    postMessage(message) {
        this._panel.webview.postMessage(message);
    }
    async _update() {
        const webview = this._panel.webview;
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'media', 'main.js'));
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'media', 'vscode.css'));
        // Use a nonce to only allow a specific script to be run
        const nonce = this.getNonce();
        const html = `
      <!DOCTYPE html>
      <html lang="pt-br">
      <head>
          <meta charset="UTF-8">

          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: vscode-resource:; script-src 'nonce-${nonce}'; style-src vscode-resource: 'unsafe-inline';">

          <meta name="viewport" content="width=device-width, initial-scale=1.0">

          <link href="${styleResetUri}" rel="stylesheet">
          <link href="${styleVSCodeUri}" rel="stylesheet">

          <script nonce="${nonce}   src="${scriptUri}"></script>
		  </head>
		  <body>
			  <div id="chat-container"></div>
		  </body>
		  </html>
		`;
        this._panel.webview.html = html;
    }
    _generateCode(prompt) {
        const options = {
            hostname: 'api.optimuncodegpt.com',
            port: 443,
            path: `/api/v1/generate?prompt=${encodeURIComponent(prompt)}&apiKey=${this._apiKey}`,
            method: 'GET'
        };
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                const response = JSON.parse(data);
                this.postMessage({ type: 'codeGenerated', code: response.code });
            });
        });
        req.on('error', err => {
            this.postMessage({ type: 'error', message: err.message });
        });
        req.end();
    }
    getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}
ChatPanel.viewType = 'optimuncodegpt.chat';
function activate(context) {
    const extensionUri = vscode.Uri.file(context.extensionPath);
    const chatCommand = vscode.commands.registerCommand('extension.openChat', () => {
        const apiKey = vscode.workspace
            .getConfiguration('optimuncodegpt')
            .get('apiKey');
        if (!apiKey) {
            vscode.window.showErrorMessage('Optimun Code GPT: Please set your API key in the settings.');
            return;
        }
        ChatPanel.createOrShow(extensionUri, apiKey);
    });
    const reviveChatCommand = vscode.commands.registerCommand('extension.reviveChat', (panel, apiKey) => {
        ChatPanel.revive(panel, extensionUri, apiKey);
    });
    context.subscriptions.push(chatCommand, reviveChatCommand);
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map