import {
    JavaScriptParser, expressionVisitor, ExpressionNode,
    VisitorControl, VisitorCallback
} from '@ibyar/expressions';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { relative, resolve } from 'path';
import { ImportSyntax } from './transform.js';
import { getPackageInfo, PackageInfo } from '../esmpack/package-info.js';
import { getFileExtension, isDirectory, mkdirSyncIfNotExists, trackPackage, TrackPackageType } from '../utils/utils.js';
import { generateHelper } from '../plugins/injection/helpers.js';
import { AbstractTransformerHandler, HelperOptions } from './package.js';

export function collectImportExportExpression(list: ExpressionNode[]): VisitorCallback {
    return (expression: ExpressionNode, type: string, control: VisitorControl) => {
        switch (type) {
            case 'ImportExpression':
            case 'ImportDeclaration':
            case 'ExportAllDeclaration':
            case 'ExportNamedDeclaration':
            case 'ExportDefaultDeclaration':
                list.push(expression);
                break;
            default:
                break;
        }
    };
}


export class ModuleExpressionWalker extends AbstractTransformerHandler {

    handle(input: string, output: string, opt: HelperOptions, transformedFiles: string[] = []): boolean {
        if (isDirectory(input) || !existsSync(input) || transformedFiles.includes(output)) {
            return false;
        }
        const script = readFileSync(input, 'utf8').toString();
        let content = script;
        const srcDir = resolve(input, '..');
        const outDir = resolve(output, '..');
        let inputExt = this.config.extension || getFileExtension(input) || '.js';
        mkdirSyncIfNotExists(outDir);

        let searchContent = this.removeComments(content);
        const followImport: { src: string, out: string }[] = [];
        let injectModuleInfo = false;

        const module = JavaScriptParser.parse(script, { addLocation: true });

        const importExportList:ExpressionNode[] = [];

        expressionVisitor.visit(module, collectImportExportExpression(importExportList));
        

        let allMatch = ImportSyntax.getImportSyntax(searchContent);

        allMatch.forEach(importSyntax => {

            let filePath: string, outPath: string;
            let targetPackageInfo: PackageInfo | undefined;
            let tracker: TrackPackageType | undefined;
            if (/^\./.test(importSyntax.modulePath)) {
                // workspace resources
                outPath = resolve(outDir, importSyntax.modulePath);
                filePath = resolve(srcDir, importSyntax.modulePath);
            } else {
                tracker = trackPackage(importSyntax.modulePath, opt.nodeModulePath);
                if (!tracker) {
                    console.error(`can't find node package for '${importSyntax.modulePath}'`);
                    return;
                }

                if (opt.provider.has(tracker.packageName)) {
                    targetPackageInfo = opt.provider.get(tracker.packageName) as PackageInfo;
                } else {
                    targetPackageInfo = getPackageInfo(tracker.packagePath, opt.outDir);
                    opt.provider.set(targetPackageInfo.getName(), targetPackageInfo);
                }
                if (tracker.subPath) {
                    outPath = targetPackageInfo.resolveOut(tracker.subPath);
                    filePath = resolve(tracker.nodeModulePath, tracker.packageName, tracker.subPath);
                } else {
                    outPath = resolve(opt.outDir, tracker.packageName, targetPackageInfo.index);
                    filePath = resolve(tracker.nodeModulePath, tracker.packageName, targetPackageInfo.index);
                }
            }
            {
                let isDir = isDirectory(filePath);
                if (!existsSync(filePath) || isDir) {
                    if (existsSync(filePath + inputExt)) {
                        filePath += inputExt;
                        outPath += inputExt;
                    } else if (isDir) {
                        let fileTemp = resolve(filePath, 'index' + inputExt);
                        if (existsSync(fileTemp)) {
                            filePath = fileTemp;
                            outPath = resolve(outPath, 'index' + inputExt);
                        } else {
                            return;
                        }
                    } else {
                        return;
                    }
                }
            }


            if (! /\.m?js$/g.test(filePath)) {
                // plugin scope

                let plugin = this.searchPlugin(importSyntax.modulePath, opt.plugins);
                if (!plugin) {
                    console.error(`can't find plugin for  '${importSyntax.statement}'`);
                    return;
                }
                // this.config.baseUrl = this.config.baseUrl || '/';
                // let staticFilePath = this.config.baseUrl + relative(opt.outDir, outPath);
                // let result = plugin.handler.transform(match, staticFilePath);
                let relativeFilePath = relative(outDir, outPath);
                injectModuleInfo = true;
                let result = plugin.handler.transform(importSyntax, relativeFilePath);
                switch (result.action) {
                    case 'replace':
                    case 'fetch':
                        content = content.replace(importSyntax.statement, result.inline);
                        mkdirSyncIfNotExists(resolve(outPath, '..'));
                        copyFileSync(filePath, outPath);
                        break;
                    case 'module':
                    default:
                        let statement = importSyntax.toDefaultModuleStatementString(inputExt);
                        content = content.replace(importSyntax.statement, statement);
                        let buffer = readFileSync(filePath);
                        let resModuleContent = `export default ${JSON.stringify(buffer.toString())};`;
                        outPath += '.' + inputExt;
                        mkdirSyncIfNotExists(resolve('outPath', '..'));
                        writeFileSync(outPath, resModuleContent);
                        break;
                }
            } else {
                let result = opt.jsTransformer.transform(importSyntax, {
                    buildDir: opt.packageInfo.out,
                    hostJsPath: output,
                    nodeModulePath: opt.nodeModulePath,
                    packageProvider: opt.provider,
                    hostPackageInfo: opt.packageInfo,
                    targetPackageInfo,
                    tracker
                });
                if (result) {
                    let followPath = importSyntax.modulePath;
                    if (result?.action === 'inline' && result.inlinePath && /^\/|\.\/|\.\.\//.test(result.inlinePath)) {
                        followPath = result.inlinePath + (result.appendExt || '');
                        let newPath = importSyntax.quoteMarks + followPath + importSyntax.quoteMarks;
                        let oldPath = importSyntax.quoteMarks + importSyntax.modulePath + importSyntax.quoteMarks;
                        let newStatement = importSyntax.statement.replace(oldPath, newPath);

                        let srcStatement = importSyntax.statement;
                        let srcLastLineIndex = importSyntax.statement.lastIndexOf('\n');
                        if (srcLastLineIndex > 0) {
                            srcStatement = srcStatement.substring(srcLastLineIndex + 1);
                            newStatement = newStatement.substring(newStatement.lastIndexOf('\n') + 1);
                        }
                        content = content.replace(srcStatement, newStatement);
                        if (targetPackageInfo && targetPackageInfo !== opt.packageInfo) {
                            return;
                        }
                    }
                    let followSrc = resolve(srcDir, followPath);
                    let followOut = resolve(outDir, followPath);
                    followImport.push({ src: followSrc, out: followOut });
                }
            }
        });
        if (this.config.prod) {
            if (injectModuleInfo) {
                content = generateHelper('define:prod') + content;
            }
            // remove source map im prod mode
            content = this.removeSourceMap(content);
            // TO:DO minify content before write
        } else {
            if (injectModuleInfo) {
                content = content + '\n' + generateHelper('define:dev');
            }
        }

        writeFileSync(output, content);
        content = searchContent = '';
        transformedFiles.push(output);
        followImport.forEach(item => this.handle(item.src, item.out, opt, transformedFiles));
        return true;
    }
}
