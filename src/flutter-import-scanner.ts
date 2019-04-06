import * as FS from 'fs';
import * as vscode from 'vscode';
import * as _ from 'lodash';

import { ImportDb } from './import-db';
import { AutoImport } from './flutter-auto-import';

export class ImportScanner {

    private scanStarted: Date;

    private scanEnded: Date;

    private showOutput: boolean;

    private filesToScan: string;

    private showNotifications: boolean;

    constructor(private config: vscode.WorkspaceConfiguration) {
        this.filesToScan = this.config.get<string>('filesToScan');
        this.showNotifications = this.config.get<boolean>('showNotifications');
    }

    public scan(request: any): void {

        this.showOutput = request.showOutput ? request.showOutput : false;

        if (this.showOutput) {
            this.scanStarted = new Date();
        }

        let scanLocation: any = this.filesToScan;

        if (request.workspace !== undefined) {
            scanLocation = new vscode.RelativePattern(request.workspace.uri.path+'/lib', scanLocation);
        }
        vscode.workspace
            .findFiles(scanLocation, '**/node_modules/**', 99999)//node_modules是屏蔽的目录
            .then((files) => {
                // 这里会搜索当前目录所有文件
                this.processWorkspaceFiles(files)
            });

        // vscode.commands
        //     .executeCommand('extension.scanNodeModules');

    }

    public edit(request: any): void {
        ImportDb.delete(request);
        this.loadFile(request.file, request.workspace, true);
        // new NodeUpload(vscode.workspace.getConfiguration('autoimport')).scanNodeModules();

    }

    public delete(request: any): void {
        ImportDb.delete(request);
        AutoImport.setStatusBar();
    }


    private processWorkspaceFiles(files: vscode.Uri[]): void {

        // 过滤
        // let pruned = files.filter((f) => {
        //     return f.fsPath.indexOf('typings') === -1 &&
        //         f.fsPath.indexOf('node_modules') === -1 &&
        //         f.fsPath.indexOf('jspm_packages') === -1;
        // });
        let pruned = files
        pruned.forEach((f, i) => {

            let workspace: vscode.WorkspaceFolder
                = vscode.workspace.getWorkspaceFolder(f)

            this.loadFile(f, workspace, i === (pruned.length - 1));


        });
    }

    private loadFile(file: vscode.Uri, workspace: vscode.WorkspaceFolder, last: boolean): void {
        if (~file.fsPath.indexOf('main.dart')) {
            return;
        }
        FS.readFile(file.fsPath, 'utf8', (err, data) => {

            if (err) {
                return console.log(err);
            }

            this.processFile(data, file, workspace);
            if (last) {
                AutoImport.setStatusBar();
            }

            if (last && this.showOutput && this.showNotifications) {
                this.scanEnded = new Date();

                let str = `[AutoImport] cache creation complete - (${Math.abs(<any>this.scanStarted - <any>this.scanEnded)}ms)`;

                vscode.window
                    .showInformationMessage(str);
            }

        });
    }

    private processFile(data: any, file: vscode.Uri, workspace: vscode.WorkspaceFolder): void {

        var classMatches = data.match(/(class) ([a-zA-Z])+/g),
            enumMatches = data.match(/(enum) ([a-zA-Z])+/g)

        if (classMatches) {
            classMatches.forEach(m => {
                let workingFile: string =
                    m.replace('class ', '');

                ImportDb.saveImport(workingFile, data, file, workspace);
            });
        }

        if (enumMatches) {
            enumMatches.forEach(m => {
                let workingFile: string =
                    m.replace('enum ', '');

                ImportDb.saveImport(workingFile, data, file, workspace);
            });
        }
    }
}