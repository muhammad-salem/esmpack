import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { relative, resolve } from 'path';
import { ImportSyntax, JsTransformDescription, JSTransformer } from './transform.js';
import { getPackageInfo, PackageInfo } from '../esmpack/package-info.js';
import { PluginHandler } from '../plugins/plugin.js';
import { getFileExtension, isDirectory, mkdirSyncIfNotExists, trackPackage, TrackPackageType } from '../utils/utils.js';
import { ESMConfig } from '../esmpack/config.js';
import { generateHelper } from '../plugins/injection/helpers.js';

export interface HelperOptions {
    jsTransformer: JSTransformer;
    plugins: PluginHandler[];
    provider: Map<string, PackageInfo>;
    packageInfo: PackageInfo;
    nodeModulePath: string;
    outDir: string;
}

export function getCommentPattern() {
    // return /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm;
    return /(?:(?:^|\s)\/\/(.+?)$)|(?:\/\*(.*?)\*\/)/gms;
}

export class TransformerHandler {

    constructor(protected config: ESMConfig) { }

    private removeComments(content: string) {
        return content.replace(getCommentPattern(), '');
    }

    private searchPlugin(path: string, plugins: PluginHandler[]) {
        return plugins.find(plugin => {
            let isTheOne = plugin.regexp.test(path);
            plugin.regexp.lastIndex = 0;
            return isTheOne;
        });
    }

    handle(input: string, output: string, opt: HelperOptions, transformedFiles: string[] = []): string[] | false {
        if (isDirectory(input) || !existsSync(input) || transformedFiles.includes(output)) {
            return false;
        }
        let content = readFileSync(input, 'utf8').toString();
        const srcDir = resolve(input, '..');
        const outDir = resolve(output, '..');
        let inputExt = this.config.extension || getFileExtension(input) || '.js';
        mkdirSyncIfNotExists(outDir);

        let searchContent = this.removeComments(content);
        let followImport: { src: string, out: string }[] = [];
        let injectModuleInfo = false;

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
                if (result.action === 'replace') {
                    content = content.replace(importSyntax.statement, result.inline);
                } else if (result.action === 'fetch') {
                    content = content.replace(importSyntax.statement, result.inline);
                    mkdirSyncIfNotExists(resolve(outPath, '..'));
                    copyFileSync(filePath, outPath);
                } else {
                    /**result.action === 'module'**/
                    let statement = importSyntax.toDefaultModuleStatementString(inputExt);
                    content = content.replace(importSyntax.statement, statement);
                    let buffer = readFileSync(filePath);
                    let resModuleContent = `export default ${JSON.stringify(buffer.toString())};`;
                    outPath += '.' + inputExt;
                    mkdirSyncIfNotExists(resolve('outPath', '..'));
                    writeFileSync(outPath, resModuleContent);
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
            // TO:DO minify content before write
            // TO:DO remove source map im prod mode

        } else {
            if (injectModuleInfo) {
                content = content + '\n' + generateHelper('define:dev');
            }
        }

        writeFileSync(output, content);
        content = searchContent = '';
        transformedFiles.push(output);
        followImport.forEach(item => this.handle(item.src, item.out, opt, transformedFiles));
        // return [input].concat(followImport.map(files => files.src));
        return transformedFiles;
    }
}

export interface StatementActionOptions {
    result: JsTransformDescription;
    content: string;
    match: ImportSyntax;
    helperOptions: HelperOptions;
    followImport: { src: string, out: string }[];
    srcDir: string;
    outDir: string;
}
