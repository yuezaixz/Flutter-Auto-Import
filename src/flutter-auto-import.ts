import * as vscode from 'vscode';
import { ImportDb } from './import-db';
import { ImportAction } from './flutter-import-action';
import { ImportScanner } from './flutter-import-scanner';
import { print } from 'util';

export class AutoImport {

    public static statusBar;

    constructor(private context: vscode.ExtensionContext) { }

    public start(): boolean {

        let folder = vscode.workspace.rootPath;

        if (folder === undefined) {
            return false;
        }

        return true;
    }

    public attachCommands(): void {

        // 不用实时检查，就不用开启了
        // let codeActionFixer = vscode.languages.registerCodeActionsProvider('dart', new ImportAction())

        console.log(22222);
        let disposable = vscode.commands.registerCommand('extension.flutterautoimport', function () {
            let items: vscode.QuickPickItem[] = [];
            let allImports = ImportDb.all();
            for (let index = 0; index < allImports.length; index++) {
              let item = allImports[index];
              items.push({ 
                label: item.name, 
                description: item.name, 
                detail: item.file.path});
            }
            vscode.window.showQuickPick(
            items,
            {
                ignoreFocusOut:true,
                matchOnDescription:true,
                matchOnDetail:true,
                placeHolder:'选择要引入的库？'
            }).then(function(msg){
                var filePath = msg.detail;
                var libIndex = filePath.indexOf('lib')
                if (libIndex >= 0) {
                    var filePaths = filePath.split('lib')
                    var prefixs = filePaths[0].split('/')
                    var moduleName = prefixs[prefixs.length-2]
                    var relativePath = "import 'package:"+moduleName+filePaths[1]+"';\n"
                    let edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
                    
                    console.log(vscode.window.activeTextEditor.document.uri , new vscode.Position(0, 0),relativePath);
                    edit.insert(vscode.window.activeTextEditor.document.uri , new vscode.Position(0, 0),relativePath);
                    vscode.workspace.applyEdit(edit)
                }
                console.log();
            })
        });

        let importScanner = vscode.commands.registerCommand('extension.importScan', (request: any) => {

            let scanner = new ImportScanner(vscode.workspace.getConfiguration('autoimport'))

            if (request.showOutput) {
                scanner.scan(request);
            } else if (request.edit) {
                scanner.edit(request);
            }
            else if (request.delete) {
                scanner.delete(request);
            }
        });

        AutoImport.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1);

        AutoImport.statusBar.text = '{--} : Scanning.. ';

        AutoImport.statusBar.show();

        this.context.subscriptions.push(importScanner, disposable, AutoImport.statusBar);
        // this.context.subscriptions.push(importScanner, importFixer, nodeScanner, codeActionFixer, AutoImport.statusBar, completetion);
    }

    public attachFileWatcher(): void {
        
        var multiWorkspace = vscode.workspace.workspaceFolders.length > 0;

        if (multiWorkspace === true) {
            
            vscode.workspace.workspaceFolders.forEach(workspace => {

                let glob = vscode.workspace.getConfiguration('autoimport').get<string>('filesToScan');

                const relativePattern = new vscode.RelativePattern(workspace, glob);

                let watcher = vscode.workspace.createFileSystemWatcher(relativePattern);

                watcher.onDidChange((file: vscode.Uri) => {
                    console.log('multiWorkspace change');
                    vscode.commands
                        .executeCommand('extension.importScan', { workspace, file, edit: true });
                })

                watcher.onDidCreate((file: vscode.Uri) => {
                    console.log('multiWorkspace create');
                    vscode.commands
                        .executeCommand('extension.importScan', { workspace, file, edit: true });
                })

                watcher.onDidDelete((file: vscode.Uri) => {
                    console.log('multiWorkspace delete');
                    vscode.commands
                        .executeCommand('extension.importScan', { workspace, file, delete: true });
                })


            });

        } else {

            let glob = vscode.workspace.getConfiguration('autoimport').get<string>('filesToScan');

            let watcher = vscode.workspace.createFileSystemWatcher(glob);

            let workspace = undefined;

            watcher.onDidChange((file: vscode.Uri) => {
                console.log('singleWorkspace change');
                vscode.commands
                    .executeCommand('extension.importScan', { workspace, file, edit: true });
            })

            watcher.onDidCreate((file: vscode.Uri) => {
                console.log('singleWorkspace create');
                vscode.commands
                    .executeCommand('extension.importScan', { workspace, file, edit: true });
            })

            watcher.onDidDelete((file: vscode.Uri) => {
                console.log('singleWorkspace delete');
                vscode.commands
                    .executeCommand('extension.importScan', { workspace, file, delete: true });
            })
        }


    }

    public scanIfRequired(): void {

        let settings = this.context.workspaceState.get<any>('auto-import-settings')

        let firstRun = (settings === undefined || settings.firstRun);

        if (vscode.workspace.getConfiguration('autoimport').get<boolean>('showNotifications')) {
            vscode.window
                .showInformationMessage('[AutoImport] Building cache');
        }

        var multiWorkspace = vscode.workspace.workspaceFolders.length > 0;

        if (multiWorkspace === true) {

            vscode.workspace.workspaceFolders.forEach(workspace => {

                vscode.commands
                    .executeCommand('extension.importScan', { workspace, showOutput: true });

            });
        } else {

            vscode.commands
                .executeCommand('extension.importScan', { showOutput: true });
        }


        settings.firstRun = true;

        this.context.workspaceState.update('auto-import-settings', settings);
    }

    public static setStatusBar() {
        AutoImport.statusBar.text = `{..} : ${ImportDb.count}`;
    }

}