import { type } from 'os';
import { ImportSyntax, NameAlias } from '../resolution/transform.js';
import { ClassInfo, ClassInfoType, TypeOf } from '../utils/class.js';
import { FetchType, generateFetch, generateFetchAll, generateFetchAllAndDefault, generateFetchFor, MarkType } from './injection/fetch.js';
import { generateInject } from './injection/inject.js';

/**
 * for now, the output of an Plugin will be static import statement.
 * 
 * the Plugin reaction to provided statement and code
 * `inject`  will inject code instated of the current import/export statement.
 * 
 * `fetch` will copy the content of this code to its build location and replace
 * the  import/export statement with a fetch and declare a const variable if exists.
 * 
 *  `module` will convert the the content file to a module, useful at create a resources module .
 * 
 *  * `inject` example:
 * ```
 * import 'bootstrap/dist/css/bootstrap.css';
 * (function(){fetch(`/${importResolution:relative|static|flat}/bootstrap/dist/css/bootstrap.css`)
 * .then(response => {const style = document.createElement('style'); style.textContent = response.text(); document.head.append(style);})})()
 * OR
 *  (function(path, options){fetch(path, options)
 * .then(response => {const style = document.createElement('style'); style.textContent = response.text(); document.head.append(style);})})()
 * 
 * export * from 'bootstrap/dist/css/bootstrap.css';
 * bad practice, same as import with no object name
 * ```
 * 
 *  * `fetch` example:
 * ```
 * import bootstrap from 'bootstrap/dist/css/bootstrap.min.css';
 * const bootstrap = await fetch(`/${importResolution:relative|static|flat}/bootstrap/dist/css/bootstrap.css`).then(response => response.text());
 * 
 * ```
 *  * `module` example
 * ```
 * export { default as Breadcrumbs } from 'bootstrap/dist/css/bootstrap.min.css';
 * export { default as Breadcrumbs } from '${importResolution:relative|static|flat}/bootstrap/dist/css/bootstrap.min.css';
 * ``` 
 * 
 * `file` :bootstrap/dist/css/bootstrap.min.css.js
 * ```
 * const value = "${content of: 'bootstrap/dist/css/bootstrap.min.css'}";
 * export default value;
 * ```
 */
export type PluginActionType = 'inject' | 'fetch' | 'module';

export class PluginAction {
    constructor(public action: PluginActionType, public inline: string = '') { }
}

export type PluginHandler = { regexp: RegExp; handler: Plugin; };


export interface PluginInterface {
    transform(importSyntax: ImportSyntax, relativeFilePath: string): PluginAction;
}

export type PluginType = TypeOf<PluginInterface> & ClassInfoType;


export class Plugin implements PluginInterface {

    constructor(protected moduleType: FetchType | MarkType) { }

    protected handelExport(importSyntax: ImportSyntax, path: string): PluginAction {
        throw new Error('export non js module is not supported yet');
    }

    protected handleImport(importSyntax: ImportSyntax, path: string): PluginAction {
        if (importSyntax.hasExports()) {
            let propName: false | NameAlias;
            if (propName = importSyntax.isImportAllOnly()) {
                /**
                 * normal import statement
                 * import * as bindingName from 'bootstrap.css';
                 */
                if (propName.hasAlias()) {
                    return new PluginAction('fetch', generateFetch(this.moduleType, path, propName.getName()));
                } else {
                    // return new PluginAction('inject', this.inject(path));
                    throw new Error(`can't import * to js module, must provide an alias for the import binding.`);
                }
            } else if (propName = importSyntax.isDefaultExportOnly()) {
                /**
                 * import bootstrap from 'bootstrap.css';
                 */
                return new PluginAction('fetch', generateFetch(this.moduleType, path, propName.getName()));
            } else if (importSyntax.isDefaultAndImportAll() && importSyntax.importAll && importSyntax.defaultExport) {
                /**
                 * import defaultExport, * as name from "module-name";
                 */
                if (importSyntax.importAll.hasAlias()) {
                    let code = generateFetchAllAndDefault(this.moduleType, path,
                        importSyntax.importAll.getName(), importSyntax.defaultExport.getName());
                    return new PluginAction('fetch', code);
                } else {
                    throw new Error(`can't import * to js module, must provide an alias for the import binding.`);
                }
            } else if (importSyntax.isExportNamesAndDefault()) {
                /**
                 * import defaultExport, { export1 [ , [...] ] } from "module-name";
                 */
                return new PluginAction('fetch', generateFetchFor(path, importSyntax, this.moduleType));
            }
            // else if (importSyntax.isExportNamesOnly()) {
            /**
             * import { export1 } from "module-name";
             * import { export1 as alias1 } from "module-name";
             * import { export1 , export2 } from "module-name";
             * // import { export1 , export2, export3 } from "module-name";
             * only promise and value and value
             */
            return new PluginAction('fetch', generateFetchFor(path, importSyntax, this.moduleType));
        } else {
            /**
             * just import file
             * inject to document
             * import 'bootstrap.css';
             */
            throw new Error(`can't import * to js module, must provide an alias for the import binding.`);
        }
    }

    transform(importSyntax: ImportSyntax, relativeFilePath: string): PluginAction {
        if (importSyntax.syntaxType.isExport()) {
            return this.handelExport(importSyntax, relativeFilePath);
        } else {
            return this.handleImport(importSyntax, relativeFilePath);
        }
    }

}


export const BuiltinPlugin = new Map<string, PluginHandler>();

class CSSPlugin extends Plugin {
    constructor(moduleType: FetchType | MarkType) {
        super(moduleType);
        let oldTransform = this.transform.bind(this);
        this.transform = (importSyntax: ImportSyntax, relativeFilePath: string): PluginAction => {
            try {
                return oldTransform(importSyntax, relativeFilePath);
            } catch (e) {
                // inject css to dom
                let code = generateInject('style', relativeFilePath);
                if (importSyntax.defaultExport) {
                    let fetch = generateFetchFor(relativeFilePath, importSyntax, this.moduleType);
                    code += fetch;
                }
                return new PluginAction('inject', code);
            }
        };
    }
}

BuiltinPlugin.set('css', { regexp: /\.css$/g, handler: new CSSPlugin('text') });
BuiltinPlugin.set('html', { regexp: /\.html?$/g, handler: new Plugin('text') });
BuiltinPlugin.set('text', { regexp: /\.txt$/g, handler: new Plugin('text') });
BuiltinPlugin.set('json', { regexp: /\.json$/g, handler: new Plugin('json') });

function getRegExp(ext: string[]) {
    return new RegExp(`\.(${ext.join('|')})$`, 'g');
}
const ImageMIME = ['apng', 'bmp', 'gif', 'ico', 'cur', 'jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp', 'png', 'svg', 'tif', 'tiff', 'webp'];
const AudioMIME = ['3gp', 'flac', 'mpg', 'mpeg', 'mp3', 'mp4', 'm4a', 'oga', 'ogg', 'wav', 'webm'];

BuiltinPlugin.set('image', { regexp: getRegExp(ImageMIME), handler: new Plugin('objectURL') });
BuiltinPlugin.set('audio', { regexp: getRegExp(AudioMIME), handler: new Plugin('arrayBuffer') });

export function findPluginByName(name: string): PluginHandler | undefined {
    switch (name.toLowerCase()) {
        case 'style': name = 'css'; break;
        case 'htm': name = 'html'; break;
        case 'img': name = 'image'; break;
        case 'txt': name = 'text'; break;
    }
    if (BuiltinPlugin.has(name)) {
        return BuiltinPlugin.get(name);
    }
}
