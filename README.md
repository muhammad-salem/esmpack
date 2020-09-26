# esmpack

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![LICENSE][license-img]][license-url]
![npm-dependencies][npm-dep-url]
![GitHub contributors][contributors]

[npm-image]: https://img.shields.io/npm/v/@aurorats/esmpack.svg
[npm-url]: https://npmjs.org/package/@aurorats/esmpack
[downloads-image]: https://img.shields.io/npm/dt/@aurorats/esmpack
[downloads-url]: https://npmjs.org/package/@aurorats/esmpack
[license-img]: https://img.shields.io/github/license/aurorats/esmpack
[license-url]: https://github.com/aurorats/esmpack/blob/master/LICENSE
[npm-dep-url]: https://img.shields.io/david/aurorats/esmpack.svg?maxAge=2592000
[contributors]: https://img.shields.io/github/contributors/aurorats/esmpack

esmpack, transform javascript files to es module that can be imported by browser.

## `Install`

 - As Global

``` bash
npm i -g @aurorats/esmpack
yarn global add @aurorats/esmpack
```
 - As Developer Dependencies

``` bash
npm i --save-dev @aurorats/esmpack
yarn add --dev @aurorats/esmpack
```

# How to use

can load config from js file (es module), or json file, if not 

```
Version 0.1.4
Usage: esmpack [config path] [options]

if no config file in the commend will try to search for file names
'esmpack.js', 'esmpack.mjs' and 'esmpack.json'.

Examples:
    esmpack
    esmpack esmpack.js
    esmpack esmpack.json -w -d
    esmpack -v
    esmpack --help

Options:
            --prod      build for production, minify modules, css, etc...
    -d      --debug     output debug messages on internal operations
    -s      --silent    don't print any thing
    -w      --watch     watch files for change
    -h      --help      print help message
    -v      --version   output the version number
```

# Javascript Config file

Could be a js module file with default export as `ESMConfig` object. in that case make sure the `package.json` is marked as module package, `{"type": "module"}`. this options is useful for loading external plugins or override the built-in plugins behavior. 

```js
import { CSSPlugin, HTMLPlugin, ImagePlugin, JSONPlugin, TextPlugin } from '@aurorats/esmpack';
export const config = {
    outDir: 'build/mjs/',
    moduleResolution: 'relative',
    pathMap: { 'src': 'dist' },
    src: {
        files: [],
        include: ['./dist/**/*.js'],
        exclude: []
    },
    resources: {
        files: [],
        include: ['./src/**/*.*'],
        exclude: ['./src/**/*.{js,ts,tsx}']
    },
    plugins: [
        CSSPlugin,
        JSONPlugin,
        ImagePlugin,
        HTMLPlugin,
        TextPlugin
    ]
};
export default config;
```
if no plugins had provided, will add the built-in plugins as default;  

# JSON Config file

plugins options will be the name of built-in plugin.

```json
{
    "moduleResolution": "relative",
    "outDir": "build/mjs/",
    "pathMap": {
        "src": "dist"
    },
    "src": {
        "files": [],
        "include": [
            "./dist/**/*.js"
        ],
        "exclude": []
    },
    "resources": {
        "files": [],
        "include": [
            "./src/**/*.*"
        ],
        "exclude": [
            "./src/**/*.{js,ts,tsx}"
        ]
    },
    "plugins": [
        "css",
        "html",
        "json",
        "text",
        "image"
    ]
}
```

# API ESMConfig Interface

```ts
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
```

## ClI JSConfig Interface

```ts
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
```


# How to build A Plugin

- for now all plugin intercepting only `import` and `export` statement.
- to create a plugin must extend class `Plugin` and provide plugin name and regex for testing

```ts
import { ClassInfo, Plugin } from '@aurorats/esmpack';
@ClassInfo('css', /\.css$/g)
export class CSSPlugin extends Plugin {
    inject(url: string): string {
        // import 'bootstrap/dist/css/bootstrap.min.css';
    }
    fetch(url: string, importName: string): string {
        // import bootstrap from 'bootstrap/dist/css/bootstrap.min.css';
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        // import bootstrap, {promise as whenCSSFileLoaded} from './bootstrap.min.css';
    }
}
```

or Simply

```ts
import { Plugin } from '@aurorats/esmpack';
export class CSSPlugin extends Plugin {

    static getName(): string { return 'css'; };
    static getRegExp(): RegExp { return /\.css$/g; }

    inject(url: string): string {
        // import 'bootstrap/dist/css/bootstrap.min.css';
    }
    fetch(url: string, importName: string): string {
        // import bootstrap from 'bootstrap/dist/css/bootstrap.min.css';
    }
    fetchWithPromise(url: string, promiseName: string, importName?: string): string {
        // import bootstrap, {promise as whenCSSFileLoaded} from './bootstrap.min.css';
    }
}
```

## TO:DO

- watch
- production
- set extension of module file to '.js' or '.mjs', currently, doesn't override filename.
- moduleResolution `static` and `flat` : currently `relative` is supported
