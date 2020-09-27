import { resolve } from 'path';
import { getPackageInfo, PackageInfo } from '../esmpack/package-info.js';
import { trackPackage } from '../utils/utils.js';


export class NameAlias {
    constructor(public name: string, public alias?: string) { }

    hasAlias() {
        return this.alias ? true : false;
    }

    isImportAll() {
        return this.name === '*';
    }

    isPromise() {
        return this.name === 'promise';
    }

    isURL() {
        return this.name === 'url';
    }

    isValue() {
        return this.name === 'value';
    }

    isDefaultExport() {
        return this.name !== 'url' && this.name !== 'promise' && this.name !== 'value';;
    }

    getName() {
        return this.alias || this.name;
    }
}

export type SyntaxTypeRef = 'import' | 'export';

export class SyntaxType {
    constructor(public syntaxType: SyntaxTypeRef) { }
    isImport() {
        return this.syntaxType === 'import';
    }
    isExport() {
        return this.syntaxType === 'export';
    }
}

export class ImportSyntax {

    static getModuleRegExp() {
        // return /(import|export)((.*)from\s*)?\s*["'](.*)["'](\s*;)?/g;
        return /(import|export)\s+?(?:(?:([\w*\s{},ɵ]*)\s+from\s+?)|)((?:".*?")|(?:'.*?'))[\s]*?(?:;|$|)/g;
    }

    static getImportSyntax(content: string): ImportSyntax[] {
        if (content) {
            let match = content.match(ImportSyntax.getModuleRegExp());
            if (match) {
                return match
                    .map(statement => ImportSyntax.getModuleRegExp().exec(statement))
                    .filter(arr => arr !== null)
                    .map(match => new ImportSyntax(match as RegExpExecArray));
            }
        }
        return [];
    }

    /**
     * import defaultExport, { export1 [ , [...] ] } from "module-name";
     */
    statement: string;

    syntaxType: SyntaxType;
    /**
     * the imported objects as written in js file,
     * defaultExport
     */
    defaultExport?: NameAlias | false = false;
    /**
     * '*' is imported or not, if string, had alias2
     */
    importAll: NameAlias | false = false;
    /**
     * the module path of import statement
     * (../data/module)
     */
    modulePath: string;

    /**
     * { export1 [ , [...] ] }
     * 
     * { export1 , export2 as alias2 , [...] }
     */
    exportNames: NameAlias[] = [];

    constructor(match: RegExpExecArray) {
        this.init(match);
    }

    private getNameAndAlias(str: string): NameAlias {
        let temp = str.trim().split(/\s/);
        return new NameAlias(temp[0].trim(), temp[2]?.trim());
    }
    private handleDefaultAndAll(nameAlias: NameAlias) {
        if (nameAlias.name === '*') {
            this.importAll = nameAlias;
        } else {
            this.defaultExport = nameAlias;
        }
    }
    /**
     * import defaultExport from "module-name";
     * import * as name from "module-name";
     * import defaultExport, { export1 [ , [...] ] } from "module-name";
     * import defaultExport, * as name from "module-name";
     * 
     * export * from …; // does not set the default export
     * export * as name1 from …; // Draft ECMAScript® 2O21
     */
    private handleDefaultAndGlobalNames(objectNames: string) {
        if (objectNames === '*') {
            this.importAll = new NameAlias('*');
        } else if (objectNames.includes(',')) {
            let temp = objectNames.split(',');
            temp.map(str => this.getNameAndAlias(str))
                .forEach(nameAlias => this.handleDefaultAndAll(nameAlias));
        } else {
            this.handleDefaultAndAll(this.getNameAndAlias(objectNames));
        }
    }

    private handelObjectNames(objectNames: string) {
        let temp = objectNames.split(',');
        this.exportNames = temp.map(str => this.getNameAndAlias(str));
    }

    private init(match: RegExpExecArray) {
        this.statement = match[0];
        this.syntaxType = new SyntaxType(match[1] as SyntaxTypeRef);
        this.modulePath = match[3].substring(1, match[3].length - 1);
        if (!match[2]) {
            return;
        }
        let objectNames = match[2].trim();
        let bracesIndex = objectNames.indexOf('{');
        if (bracesIndex > -1) {
            if (bracesIndex > 0) {
                let defaultAndGlobal = objectNames.substring(0, objectNames.lastIndexOf(',', bracesIndex));
                this.handleDefaultAndGlobalNames(defaultAndGlobal);
            }
            objectNames = objectNames.substring(bracesIndex + 1, objectNames.lastIndexOf('}'));
            this.handelObjectNames(objectNames);
        } else {
            this.handleDefaultAndGlobalNames(objectNames);
        }
    }

    hasExports() {
        return this.importAll || this.defaultExport || this.exportNames.length > 0;
    }

    isImportAllOnly() {
        return !(this.defaultExport || this.exportNames.length > 0) && this.importAll as NameAlias;
    }

    isDefaultExportOnly() {
        return !(this.importAll || this.exportNames.length > 0) && this.defaultExport as NameAlias;
    }

    isExportNamesOnly() {
        return this.exportNames.length > 0 && !(this.importAll || this.defaultExport);
    }

    isDefaultAndImportAll() {
        return this.defaultExport && this.importAll && this.importAll.alias && !(this.exportNames.length > 0);
    }

    isExportNamesAndDefault() {
        return !this.importAll && this.defaultExport && (this.exportNames.length > 0);
    }

    getAllExportNames() {
        return this.exportNames
            .concat([this.importAll as NameAlias, this.defaultExport as NameAlias])
            .filter(alias => alias);
    }

}

/**
 * the plugin reaction to provided statement and code
 * @type keep, don't changed the current statement.
 * @type inline, the replacement will written in js file.
 * @type file, create new file in build dir, wite provided content.
 * @type resources, add to resources module file.
 */
export type JsTransformAction = 'keep' | 'inline';


export interface TransformOptions {
    /**
     * 'node_module' resolved path 
     */
    nodeModulePath: string;
    /**
     * the current processing file which 'importStatement' fond in.
     */
    currentJsPath: string;
    /**
     * current package info, 
     */
    pkgInfo: PackageInfo;

    /**
     * provider for all listed packages,
     * should be updated when ever new instance of PackageInfo added
     */
    packageProvider: Map<string, PackageInfo>;

    /**
     * build dir of current package
     */
    buildDir: string;
}

/**
 * the return type of JSTransformer#transform() function,
 */
export class JsTransformDescription {

    /**
     * specify what to do with the output, and its type
     */
    action: JsTransformAction;

    /**
     * replacement for import/export statement path.
     */
    inlinePath?: string;

    /**
     * append this extension for file inline path. 
     */
    appendExt?: string;
    /**
     * the package of inlinePath
     */
    pkgInfo?: PackageInfo;

    constructor(action: JsTransformAction, inlinePath?: string, appendExt?: string, pkgInfo?: PackageInfo) {
        this.action = action;
        this.inlinePath = inlinePath;
        this.appendExt = appendExt;
        this.pkgInfo = pkgInfo;
    }

}

export class JSTransformer {

    static transformerName(): string {
        return 'js';
    }
    static regexp(): RegExp {
        return /\.m?js$/g;
    }

    transform(match: ImportSyntax, options: TransformOptions): JsTransformDescription | undefined {
        if (/^\.\.?\/.*\.m?js$/g.test(match.modulePath)) {
            return new JsTransformDescription('keep', undefined, undefined, options.pkgInfo);
        } else if (/^\.\.?\//g.test(match.modulePath)) {
            //appendExt: options.pkgInfo.pkg.browser ? '.js' : (options.pkgInfo.isModule ? '.mjs' : '.js')
            return new JsTransformDescription('inline', match.modulePath, '.js', options.pkgInfo);
        } else {
            let pkgTrack = trackPackage(match.modulePath, options.nodeModulePath);
            if (pkgTrack) {
                let pkgInfo: PackageInfo, isCreated: boolean = false;
                if (options.packageProvider.has(pkgTrack.packageName)) {
                    pkgInfo = options.packageProvider.get(pkgTrack.packageName) as PackageInfo;
                } else {
                    pkgInfo = getPackageInfo(pkgTrack.packagePath, options.buildDir);
                    isCreated = true;
                }
                let newPath = pkgTrack.subPath
                    ? pkgInfo.resolveSubPackage(options.currentJsPath, pkgTrack.subPath)
                    : pkgInfo.relativeOut(resolve(options.currentJsPath, '..'));
                let ext = /\.m?js$/g.test(newPath) ? undefined : '.js';
                return new JsTransformDescription('inline', newPath, ext, pkgInfo);
            } else {
                console.warn(`Couldn't found package in node_module`, {
                    path: match.modulePath,
                    node_module: options.nodeModulePath
                });
                return new JsTransformDescription('keep', undefined, undefined, options.pkgInfo);
            }
        }
    }
}