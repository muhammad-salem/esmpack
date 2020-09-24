
import { StatementMatch } from '../resolution/transform.js';
import { ClassInfo } from '../utils/class.js';
import { generateFetch } from './dom.js';

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

export abstract class Plugin {
    static getName(): string { return ''; };
    static getRegExp(): RegExp { return new RegExp(''); }
    transform(match: StatementMatch, path: string): PluginResult {
        if (/^import\s*['"]/g.test(match.statement) || /^export\s*\*\s*from/g.test(match.statement)) {
            return new PluginResult('inject', this.inject(path));
        } else if (/^import\s*\w/g.test(match.statement)) {
            return new PluginResult('fetch', this.fetch(match.object.trim(), path));
        } else {
            return new PluginResult('module');
        }
    }
    abstract inject(url: string): string;
    abstract fetch(importName: string, url: string): string;
}

export type PluginHandler = { regexp: RegExp; handler: Plugin; };

export const BuiltinPlugin = new Map<string, PluginHandler>();

@ClassInfo('css', /\.css$/g, BuiltinPlugin)
export class CSSPlugin extends Plugin {
    inject(url: string): string {
        return generateFetch('style', '', url);
    }
    fetch(importName: string, url: string): string {
        return generateFetch('text', importName, url);
    }
}

@ClassInfo('html', /\.html?$/g, BuiltinPlugin)
export class HTMLPlugin extends Plugin {
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(importName: string, url: string): string {
        return generateFetch('text', importName, url);
    }
}

@ClassInfo('text', /\.txt$/g, BuiltinPlugin)
export class TextPlugin extends Plugin {
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(importName: string, url: string): string {
        return generateFetch('text', importName, url);
    }
}


@ClassInfo('json', /\.json$/g, BuiltinPlugin)
export class JSONPlugin extends Plugin {
    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(importName: string, url: string): string {
        return generateFetch('json', importName, url);
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

    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(importName: string, url: string): string {
        return generateFetch('image', importName, url);
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

    inject(url: string): string {
        throw new Error('Method not implemented.');
    }
    fetch(importName: string, url: string): string {
        return generateFetch('audio', importName, url);
    }
}


export function findPluginByName(name: string): PluginHandler | undefined {
    switch (name.toLowerCase()) {
        case 'style': name = 'css'; break;
        case 'htm': name = 'html'; break;
        case 'image': name = 'img'; break;
        case 'text': name = 'txt'; break;
    }
    if (BuiltinPlugin.has(name)) {
        return BuiltinPlugin.get(name);
    }
}
