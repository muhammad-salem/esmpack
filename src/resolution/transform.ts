import { resolve } from 'path';
import { getPackageInfo, PackageInfo } from '../esmpack/package-info.js';
import { trackPackage } from '../utils/utils.js';

export interface StatementMatch {
    /**
     * import statement it self 
     * import { some-thing, another-thing } from '../data/module';
     */
    statement: string;
    /**
     * the imported objects as written in js file,
     * some-thing, another-thing
     */
    object: string;
    /**
     * the module path of import statement
     * (../data/module)
     */
    path: string;
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

    transform(match: StatementMatch, options: TransformOptions): JsTransformDescription | undefined {
        if (/^\.\.?\/.*\.m?js$/g.test(match.path)) {
            return new JsTransformDescription('keep', undefined, undefined, options.pkgInfo);
        } else if (/^\.\.?\//g.test(match.path)) {
            //appendExt: options.pkgInfo.pkg.browser ? '.js' : (options.pkgInfo.isModule ? '.mjs' : '.js')
            return new JsTransformDescription('inline', match.path, '.js', options.pkgInfo);
        } else {
            let pkgTrack = trackPackage(match.path, options.nodeModulePath);
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
                    path: match.path,
                    node_module: options.nodeModulePath
                });
                return new JsTransformDescription('keep', undefined, undefined, options.pkgInfo);
            }
        }
    }
}