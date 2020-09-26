import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { ImportSyntax, JsTransformDescription, JSTransformer } from './transform.js';
import { getPackageInfo, PackageInfo } from '../esmpack/package-info.js';
import { PluginHandler } from '../plugins/plugin.js';
import { getFileExtension, isDirectory, matchFileExtension, mkdirSyncIfNotExists, resolveTrackPackagePath, trackPackage } from '../utils/utils.js';
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
    return /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/g;
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
        let inputExt = getFileExtension(input) || '';
        mkdirSyncIfNotExists(outDir);

        let searchContent = this.removeComments(content);
        let followImport: { src: string, out: string }[] = [];
        let injectModuleInfo = false;

        let allMatch = ImportSyntax.getImportSyntax(searchContent);

        allMatch.forEach(match => {
            let ext = matchFileExtension(match.modulePath);
            if (ext && ! /m?js/g.test(ext[1])) {
                // plugin scope
                let plugin = this.searchPlugin(match.modulePath, opt.plugins);
                if (!plugin) {
                    console.error(`can't find module for file extension '${ext[1]}'`, match.statement);
                    return;
                }
                let filePath: string, outPath: string;
                if (/^\./.test(match.modulePath)) {
                    // workspace resources
                    outPath = resolve(outDir, match.modulePath);
                    filePath = resolve(srcDir, match.modulePath);
                    if (!existsSync(filePath)) {
                        // try to resolve from resources
                        return;
                    }
                } else {
                    let pkgTrack = trackPackage(match.modulePath, opt.nodeModulePath);
                    if (!pkgTrack) {
                        console.error(`can't find node package resources for '${match.modulePath}'`);
                        return;
                    }
                    let pkgInfo: PackageInfo;
                    if (opt.provider.has(pkgTrack.packageName)) {
                        pkgInfo = opt.provider.get(pkgTrack.packageName) as PackageInfo;
                    } else {
                        pkgInfo = getPackageInfo(pkgTrack.packagePath, opt.outDir);
                        opt.provider.set(pkgInfo.getName(), pkgInfo);
                    }
                    outPath = pkgTrack.subPath || pkgInfo.packageModel.style;
                    if (outPath) {
                        outPath = pkgInfo.resolveOut(outPath);
                    } else {
                        outPath = opt.outDir + sep + pkgTrack.packageName + sep + pkgTrack.subPath;
                    }
                    filePath = resolveTrackPackagePath(pkgTrack);
                }

                // this.config.baseUrl = this.config.baseUrl || '/';
                // let staticFilePath = this.config.baseUrl + relative(opt.outDir, outPath);
                // let result = plugin.handler.transform(match, staticFilePath);
                let relativeFilePath = relative(outDir, outPath);
                injectModuleInfo = true;
                let result = plugin.handler.transform(match, relativeFilePath);
                content = content.replace(match.statement, result.inline);

                if (result.action === 'module') {
                    let buffer = readFileSync(filePath);
                    let resModuleContent = `export default ${JSON.stringify(buffer.toString())};`;
                    if (inputExt) {
                        outPath += '.' + inputExt;
                    }
                    mkdirSyncIfNotExists(resolve('outPath', '..'));
                    writeFileSync(outPath, resModuleContent);
                } else {
                    mkdirSyncIfNotExists(resolve(outPath, '..'));
                    copyFileSync(filePath, outPath);
                }
            } else {

                // js module scop
                let result = opt.jsTransformer.transform(match, {
                    buildDir: opt.packageInfo.out,
                    currentJsPath: output,
                    nodeModulePath: opt.nodeModulePath,
                    packageProvider: opt.provider,
                    pkgInfo: opt.packageInfo
                });
                if (result) {
                    let options: StatementActionOptions = {
                        content,
                        followImport,
                        result,
                        match,
                        helperOptions: opt,
                        srcDir,
                        outDir
                    };
                    this.handleStatementAction(options);
                    content = options.content;
                }
            }
        });
        if (this.config.prod) {
            if (injectModuleInfo) {
                content = generateHelper('define:prod') + content;
            }
            // minify content before write

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

    // abstract handleStatementAction(opt: StatementActionOptions): void;
    handleStatementAction(opt: StatementActionOptions): void {
        let followPath = opt.match.modulePath;
        if (opt.result?.action === 'inline' && opt.result.inlinePath && /^\/|\.\/|\.\.\//.test(opt.result.inlinePath)) {
            let newPath = opt.result.inlinePath + (opt.result.appendExt ? opt.result.appendExt : '');
            let newStatement = opt.match.statement.replace(opt.match.modulePath, newPath);
            opt.content = opt.content.replace(opt.match.statement, newStatement);
            if (opt.result.pkgInfo && opt.result.pkgInfo !== opt.helperOptions.packageInfo) {
                return;
            }
            followPath = newPath;
        }
        let followSrc = resolve(opt.srcDir, followPath);
        let followOut = resolve(opt.outDir, followPath);
        opt.followImport.push({ src: followSrc, out: followOut });
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
