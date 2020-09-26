
import { ImportSyntax, NameAlias } from '../resolution/transform.js';
import { ClassInfo } from '../utils/class.js';
import { generateFetch } from './injection/fetch.js';
import { generateInject } from './injection/inject.js';
import { generateFetchWithPromise } from './injection/promise.js';

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
export type PluginAction = 'inject' | 'fetch' | 'module';

export class PluginResult {
    constructor(public action: PluginAction, public inline: string = '') { }
}

export interface ImportSyntaxNames {
    exportNames: string[];
    promiseName: string;
    defaultExport: string;
}

export abstract class Plugin {
    static getName(): string { return ''; };
    static getRegExp(): RegExp { return new RegExp(''); }

    private handelFetch(url: string, nameAlias: NameAlias) {
        if (nameAlias.isPromise()) {
            return new PluginResult('fetch', this.fetchWithPromise(url, nameAlias.alias || nameAlias.name));
        }
        return new PluginResult('fetch', this.fetch(url, nameAlias.alias || nameAlias.name));
    }

    private handelFetchWithPromise(url: string, name1: NameAlias, name2?: NameAlias): PluginResult {
        if (name2) {
            if (name1.isPromise()) {
                return new PluginResult('fetch', this.fetchWithPromise(url, name1.getName(), name2.getName()));
            } if (name2.isPromise()) {
                return new PluginResult('fetch', this.fetchWithPromise(url, name2.getName(), name1.getName()));
            }
        }
        return this.handelFetch(url, name1);
    }

    private handelExport(importSyntax: ImportSyntax, path: string): PluginResult {
        throw new Error('export non js module is not supported yet');
        // let exportNames = this.getModuleExportNames();
        // if (importSyntax.hasExports()) {
        //     if (importSyntax.isImportAllOnly()) {
        //     } else if (importSyntax.isDefaultExportOnly()) {
        //     } else if (importSyntax.isExportNamesOnly()) {
        //     } else if (importSyntax.isDefaultAndImportAll()) {
        //     } else if (importSyntax.isExportNamesAndDefault()) {
        //     } else {
        //     }
        // }
    }

    private handleImport(importSyntax: ImportSyntax, path: string): PluginResult {
        if (importSyntax.hasExports()) {
            let propName: false | NameAlias;
            if (importSyntax.isImportAllOnly()) {
                /**
                 * normal import statement
                 * import * from 'bootstrap.css';
                 */
                return new PluginResult('inject', this.inject(path));
            } else if (propName = importSyntax.isDefaultExportOnly()) {
                /**
                 * import bootstrap from 'bootstrap.css';
                 */
                return new PluginResult('fetch', this.fetch(path, propName.getName()));
            } else if (importSyntax.isDefaultAndImportAll()) {
                /**
                 * import defaultExport, * as name from "module-name";
                 */
                let names = this.getModuleExportNames();
                return this.handelFetchWithPromise(path, new NameAlias('promise', names.promiseName), new NameAlias('value', names.defaultExport));
            } else if (importSyntax.isExportNamesAndDefault()) {
                /**
                 * import defaultExport, { export1 [ , [...] ] } from "module-name";
                 */
                return this.handelFetchWithPromise(path,
                    importSyntax.defaultExport as NameAlias,
                    importSyntax.exportNames[0]);
            }
            // else if (importSyntax.isExportNamesOnly()) {
            /**
             * import { export1 } from "module-name";
             * import { export1 as alias1 } from "module-name";
             * import { export1 , export2 } from "module-name";
             * // import { export1 , export2, export3 } from "module-name";
             * only promise and value
             */
            return this.handelFetchWithPromise(path, importSyntax.exportNames[0], importSyntax.exportNames[1]);
            // } 
        } else {
            /**
             * just import file
             * inject to document
             * import 'bootstrap.css';
             */
            return new PluginResult('inject', this.inject(path));
        }
    }
    transform(importSyntax: ImportSyntax, path: string): PluginResult {
        if (importSyntax.syntaxType.isExport()) {
            return this.handelExport(importSyntax, path);
        } else {
            return this.handleImport(importSyntax, path);
        }
    }

    abstract getModuleExportNames(url?: string): ImportSyntaxNames;

    abstract inject(url: string): string;
    abstract fetch(url: string, importName: string): string;
    abstract fetchWithPromise(url: string, promiseName: string, importName?: string): string;
}

export type PluginHandler = { regexp: RegExp; handler: Plugin; };

export const BuiltinPlugin = new Map<string, PluginHandler>();

@ClassInfo('css', /\.css$/g, BuiltinPlugin)
export class CSSPlugin extends Plugin {

    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['css', 'style']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        return generateInject('style', url);
    }
    fetch(url: string, importName: string): string {
        return generateFetch('text', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('text', promiseName, url, importName);
    }
}

@ClassInfo('html', /\.html?$/g, BuiltinPlugin)
export class HTMLPlugin extends Plugin {

    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['html']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('text', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('text', promiseName, url, importName);
    }
}

@ClassInfo('text', /\.txt$/g, BuiltinPlugin)
export class TextPlugin extends Plugin {
    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['text', 'txt']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('text', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('text', promiseName, url, importName);
    }
}


@ClassInfo('json', /\.json$/g, BuiltinPlugin)
export class JSONPlugin extends Plugin {
    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['json']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('json', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('json', promiseName, url, importName);
    }
}

@ClassInfo('img', ImagePlugin.getRegExp(), BuiltinPlugin)
export class ImagePlugin extends Plugin {
    static MimeType: { [key: string]: string[] } = {
        'image/apng': ['apng'],
        'image/bmp': ['bmp'],
        'image/gif': ['gif'],
        'image/x-icon': ['ico', 'cur'],
        'image/jpeg': ['jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp'],
        'image/png': ['png'],
        'image/svg+xml': ['svg'],
        'image/tiff': ['tif', 'tiff'],
        'image/webp': ['webp']
    };

    static getMediaType(ext: string): string | undefined {
        for (const key in ImagePlugin.MimeType) {
            if (ImagePlugin.MimeType[key].includes(ext)) {
                return key;
            }
        }
    }

    static getRegExp() {
        let mime: string = Object.keys(ImagePlugin.MimeType)
            .map(key => ImagePlugin.MimeType[key].join('|'))
            .join('|');
        return new RegExp(mime, 'g');
    }
    getModuleExportNames(url: string): ImportSyntaxNames {
        return {
            defaultExport: 'value',
            promiseName: 'promise',
            exportNames: [url.substring(url.lastIndexOf('.'))]
        };
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('image', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('image', promiseName, url, importName);
    }
}

@ClassInfo('audio', AudioPlugin.getRegExp(), BuiltinPlugin)
export class AudioPlugin extends Plugin {
    static MIME = [
        '3gp',
        'flac',
        'mpg',
        'mpeg',
        'mp3',
        'mp4',
        'm4a',
        'oga',
        'ogg',
        'wav',
        'webm'
    ];

    static getRegExp() {
        let mime: string = AudioPlugin.MIME.join('|');
        return new RegExp(mime, 'g');
    }
    getModuleExportNames(url: string): ImportSyntaxNames {
        return {
            defaultExport: 'value',
            promiseName: 'promise',
            exportNames: [url.substring(url.lastIndexOf('.'))]
        };
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('audio', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('audio', promiseName, url, importName);
    }
}

@ClassInfo('formData', /\.formData$/g, BuiltinPlugin)
export class FormDataPlugin extends Plugin {
    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['formData']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('formData', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('formData', promiseName, url, importName);
    }
}

@ClassInfo('blob', /\.blob$/g, BuiltinPlugin)
export class BlobPlugin extends Plugin {
    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['blob']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('blob', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('blob', promiseName, url, importName);
    }
}

@ClassInfo('buff', /\.buff$/g, BuiltinPlugin)
export class ArrayBufferPlugin extends Plugin {
    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['buff']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('buff', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('buff', promiseName, url, importName);
    }
}

@ClassInfo('buf', /\.buf$/g, BuiltinPlugin)
export class BufPlugin extends Plugin {
    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['buf']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('buf', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('buf', promiseName, url, importName);
    }
}

@ClassInfo('b64', /\.b64$/g, BuiltinPlugin)
export class B64Plugin extends Plugin {
    defaultNames: ImportSyntaxNames = {
        defaultExport: 'value',
        promiseName: 'promise',
        exportNames: ['b64']
    };
    getModuleExportNames(): ImportSyntaxNames {
        return this.defaultNames;
    }
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(url: string, importName: string): string {
        return generateFetch('b64', importName, url);
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        return generateFetchWithPromise('b64', promiseName, url, importName);
    }
}

export function findPluginByName(name: string): PluginHandler | undefined {
    switch (name.toLowerCase()) {
        case 'arrayBuffer': name = 'buff'; break;
        case 'style': name = 'css'; break;
        case 'htm': name = 'html'; break;
        case 'image': name = 'img'; break;
        case 'text': name = 'txt'; break;
    }
    if (BuiltinPlugin.has(name)) {
        return BuiltinPlugin.get(name);
    }
}
