import { Plugin, PluginHandler } from '../plugins/plugin.js';

/**
 * 
 * `.js` for web, if server not support '.mjs' yet.
 * `.mjs` for nodejs 
 */
export type ModuleExtension = '.js' | '.mjs';

export interface SourceInput {

    /**
     * If no 'files' or 'include' property is present in a config file, 
     * the transformer defaults to including all files in the containing 
     * directory and subdirectories except those specified by 'exclude'.
     * When a 'files' property is specified, only those files and those
     * specified by 'include' are included.
     */
    files: string[];

    /**
     * Specifies a list of glob patterns that match files to be included in transformation.
     * If no 'files' or 'include' property is present in a config file,
     * the transformer defaults to including all files in the containing
     * directory and subdirectories except those specified by 'exclude'.
     */
    include: string[];

    /**
     * Specifies a list of files to be excluded from transformation.
     * The 'exclude' property only affects the files included
     * via the 'include' property and not the 'files' property.
     */
    exclude: string[];
}

export interface ESMConfig {

    /**
     * build dir
     */
    outDir: string;

    /**
     * location of input files
     */
    src: SourceInput;

    /**
     * resource dir to copy to and look/resolve other import
     * module '.css', '.html' '.map' files.
     */
    resources: SourceInput;

    pathMap: { [key: string]: string };

    /**
     * preferred extension for build files '.js'. 
     * 
     * for web use ".js" if your server can't handle ".mjs" 
     * as MIME type "text/javascript" and Content-Type: text/javascript.
     * 
     * for nodejs support ".mjs" out of box starting with version .
     * or As of Node 13, you can use ext: ".js"
     * and can trigger support by setting "type": "module", in package.json
     */
    extension: ModuleExtension;

    /**
     * `relative`: convert import statement to be relative path to its dir
     * ```
     * npm_modules/@models/people/model/person.js
     * export class Person {....}
     * 
     * npm_modules/@models/people/index.js
     * export { Person } from './model/person';
     * 
     * dist/views/person-component.js
     * import { Person } from '@models/people';
     * ```
     * will be
     * 
     * ```
     * {outDir}/@models/people/model/person.js
     * export class Person {....}
     * 
     * {outDir}/@models/people/index.js
     * export { Person } from './model/person.js';
     * 
     * {outDir}/dist/views/person-component.js
     * import { Person } from '../../@models/people/index.js';
     * ```
     * 
     * `static`: resolve import to be static path, 'baseUrl' should be used
     * the new path will ``` 'baseUrl' / 'pkg_name' / 'file path inside outDir'```
     *  assume baseUrl = '/js/esm'
     * the full url if http://localhost/js/esm
     * 
     * ```
     * {outDir}/@models/people/model/person.js
     * export class Person {....}
     * 
     * {outDir}/@models/people/index.js
     * export { Person } from '/js/esm/@models/model/person.js';
     * 
     * {outDir}/{project_pkg_name}/views/person-component.js
     * import { Person } from '/js/esm/@models/people/index.js';
     * ```
     * 
     * `flat`: all modules will be in 'outDir' folder,
     * files name will be combination from package name and module path, joined by '.'
     * 
     * ```
     * {outDir}/@models.people.model.person.js
     * export class Person {....}
     * 
     * {outDir}/@models.people.index.js
     * export { Person } from './@models.people.model.person.js';
     * 
     * {outDir}/{project_pkg_name}.views.person-component.js
     * import { Person } from './@models.people.index.js';
     * ```
     * 
     */
    moduleResolution: 'relative' | 'static' | 'flat';

    /**
     * Base directory to resolve 'static' module names.
     */
    baseUrl: string;

    /**
     * the output of this transformation shall 
     * scan 'all' js files in 'files' and 'include' and 'npm_modules' package.
     * 
     * or just 'follow' import statements in js module files for this workspace.
     * 
     * default to 'all'
     */
    workspaceResolution: 'all' | 'follow';

    /**
     * list of plugins to handle non-js supported files,
     * 
     * built-in plugin is ['html', 'css', 'txt' ,'json', 'image files, png, jpg, ico,...']
     */
    plugins: PluginHandler[];

    /**
     * build for production
     */
    prod: boolean,
}


export type ConfigPlugin = string | PluginHandler | typeof Plugin;

/**
 * @see ESMConfig documentation
 */
export interface JSConfig {
    outDir: string;
    src?: SourceInput;
    resources?: SourceInput;
    pathMap?: { [key: string]: string };
    extension?: ModuleExtension;
    moduleResolution?: 'relative' | 'static' | 'flat';
    baseUrl?: string;
    workspaceResolution?: 'all' | 'follow';
    plugins?: ConfigPlugin[];
}