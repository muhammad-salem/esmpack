import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { JsTransformDescription, JSTransformer, StatementMatch } from './transform.js';
import { getPackageInfo, PackageInfo } from '../esmpack/package-info.js';
import { generateFetch } from '../plugins/dom.js';
import { PluginHandler } from '../plugins/plugin.js';
import { getFileExtension, matchFileExtension, mkdirSyncIfNotExists, resolveTrackPackagePath, trackPackage } from '../utils/utils.js';
import { ESMConfig } from '../esmpack/config.js';

export interface HelperOptions {
    jsTransformer: JSTransformer;
    plugins: PluginHandler[];
    provider: Map<string, PackageInfo>;
    packageInfo: PackageInfo;
    nodeModulePath: string;
    outDir: string;
}

export const SearchPatterns = {

    gImportPattern() {
        return /import(?:["'\s]*([\w*${}\n\r\t, ]+)from\s*)?["'\s]["'\s](.*[@\w_-]+)["'\s].*;$/g;
    },

    gmImportPattern() {
        return /import(?:["'\s]*([\w*${}\n\r\t, ]+)from\s*)?["'\s]["'\s](.*[@\w_-]+)["'\s].*;$/gm;
    },

    gDynamicImportPattern() {
        return /import\((?:["'\s]*([\w*{}\n\r\t, ]+)\s*)?["'\s](.*([@\w_-]+))["'\s].*\);$/g;
    },

    gmDynamicImportPattern() {
        return /import\((?:["'\s]*([\w*{}\n\r\t, ]+)\s*)?["'\s](.*([@\w_-]+))["'\s].*\);$/gm;
    },

    gExportPattern() {
        return /export(?:["'\s]*([\w*${}\n\r\t, ]+)\s*from\s*)?["'\s]["'\s](.*[@\w_-]+)["'\s].*;$/g;
    },

    gmExportPattern() {
        return /export(?:["'\s]*([\w*${}\n\r\t, ]+)\s*from\s*)?["'\s]["'\s](.*[@\w_-]+)["'\s].*;$/gm;
    },

    gCommentPattern() {
        return /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/g;
    },

    gmCommentPattern() {
        return /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm;
    }

};


export abstract class TransformerHandler {

    constructor(protected config: ESMConfig) { }

    private getImportMatch(content: string): RegExpExecArray[] {
        if (content) {
            let match = content.match(SearchPatterns.gmImportPattern());
            if (match) {
                return match.map(statement => SearchPatterns.gImportPattern().exec(statement))
                    .filter(arr => arr !== null) as RegExpExecArray[];
            }
        }
        return [];
    }

    private getExportMatch(content: string): RegExpExecArray[] {
        if (content) {
            let match = content.match(SearchPatterns.gmExportPattern());
            if (match) {
                return match.map(statement => SearchPatterns.gExportPattern().exec(statement))
                    .filter(arr => arr !== null) as RegExpExecArray[];
            }
        }
        return [];
    }

    private removeComments(content: string) {
        return content.replace(SearchPatterns.gmCommentPattern(), '');
    }

    searchPlugin(path: string, plugins: PluginHandler[]) {
        return plugins.find(plugin => {
            let isTheOne = plugin.regexp.test(path);
            plugin.regexp.lastIndex = 0;
            return isTheOne;
        });
    }

    handle(input: string, output: string, opt: HelperOptions): void {

        if (!existsSync(input)) {
            return;
        }
        let content = readFileSync(input, 'utf8').toString();
        const srcDir = resolve(input, '..');
        const outDir = resolve(output, '..');
        let inputExt = getFileExtension(input) || '';
        mkdirSyncIfNotExists(outDir);

        let searchContent = this.removeComments(content);
        let followImport: { src: string, out: string }[] = [];
        let injectModuleInfo = false;

        let allMatch = this.getExportMatch(searchContent);
        allMatch = allMatch.concat(this.getImportMatch(searchContent));

        allMatch.map(match => {
            return {
                statement: match[0],
                object: match[1],
                path: match[2]
            } as StatementMatch
        }).forEach(match => {
            let ext = matchFileExtension(match.path);
            if (ext && ! /m?js/g.test(ext[1])) {
                // plugin scope
                let plugin = this.searchPlugin(match.path, opt.plugins);
                if (!plugin) {
                    console.error(`can't find module for file extension '${ext[1]}'`, match.statement);
                    return;
                }
                let filePath: string, outPath: string;
                if (/^\./.test(match.path)) {
                    // workspace resources
                    outPath = resolve(outDir, match.path);
                    filePath = resolve(srcDir, match.path);
                    if (!existsSync(filePath)) {
                        // try to resolve from resources
                        return;
                    }
                } else {
                    let pkgTrack = trackPackage(match.path, opt.nodeModulePath);
                    if (!pkgTrack) {
                        console.error(`can't find node package resources for '${match.path}'`);
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
                content = generateFetch('define:prod') + content;
            }
            // minify content before write

        } else {
            if (injectModuleInfo) {
                content = content + '\n' + generateFetch('define:dev');
            }
        }

        writeFileSync(output, content);
        content = searchContent = '';
        followImport.forEach(item => this.handle(item.src, item.out, opt));
    }

    abstract handleStatementAction(opt: StatementActionOptions): void;
}

export interface StatementActionOptions {
    result: JsTransformDescription;
    content: string;
    match: StatementMatch;
    helperOptions: HelperOptions;
    followImport: { src: string, out: string }[];
    srcDir: string;
    outDir: string;
}

export class PackageTransformerHandler extends TransformerHandler {

    handleStatementAction(opt: StatementActionOptions): void {
        if (opt.result?.action === 'inline' && opt.result.inlinePath && /^\/|\.\/|\.\.\//.test(opt.result.inlinePath)) {
            let newPath = opt.result.inlinePath + (opt.result.appendExt ? opt.result.appendExt : '');
            let newStatement = opt.match.statement.replace(opt.match.path, newPath);
            opt.content = opt.content.replace(opt.match.statement, newStatement);
            if (opt.result.pkgInfo && opt.result.pkgInfo !== opt.helperOptions.packageInfo) {
                return;
            }
        }
        let followSrc = resolve(opt.srcDir, opt.match.path);
        let followOut = resolve(opt.outDir, opt.match.path);
        opt.followImport.push({ src: followSrc, out: followOut });
    }

}

export class WorkspaceTransformerHandler extends TransformerHandler {

    handleStatementAction(opt: StatementActionOptions): void {
        if (opt.result?.action === 'inline' && opt.result.inlinePath && /^\/|\.\/|\.\.\//.test(opt.result.inlinePath)) {
            let newPath = opt.result.inlinePath + (opt.result.appendExt ? opt.result.appendExt : '');
            let newStatement = opt.match.statement.replace(opt.match.path, newPath);
            opt.content = opt.content.replace(opt.match.statement, newStatement);
        }
    }

}
