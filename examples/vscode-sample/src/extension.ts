import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "vscode-sample-extension" is now active!');

	let disposable = vscode.commands.registerCommand('vscode-sample-extension.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from KamoX Sample!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
