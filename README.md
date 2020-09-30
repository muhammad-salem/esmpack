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

### Javascript Config file

js config file, proved a way to connect `esmpack` with any plugin, the built-in plugins can be called by its name `css, html, json, text, image, audio`.

- The built in plugin, will try to fetch the resource with `fetch` request.
- The Built-in plugin provide 3 different information about the resource file:
 - 1-  `value` : content itself, its type controlled by the plugin, import `.json` file will return json object, import `.txt`, `.css` and `.html` will return a string object.
 - 2- `url` : a url for the resources.
 - 3- `promise`: the promise to listen, to be notified with the fetch result.

```ts
declare module '*.html' {
    export default value;
    export const value: string;
    export const url: string;
    export const promise: Promise<string>;
}

import htmlFile, {url as appUrl, promise as appPromise}  from './app-root.html';
// will be transformed to

let htmlFile;
const appUrl; 
const appPromise;
```

if didn't provide a config path to the cli, will search for config file in the `process.cwd()` for file name `esmpack.config.js` if not found, then search for  `esmpack.config.mjs`, then `esmpack.config.json`, if non of them found, will exits with error code.

Could be a js module file with default export as `JSConfig Interface` object. in that case make sure the `package.json` is marked as module package, `{"type": "module"}`. this options is useful for nodejs when (importing a non `.mjs`) OR ( import `.js`) file.

```js
let pdfHandler = (importSyntax, relativeFilePath) => {
    /**
     * write plugin for pdf files
     * convert the pdf file to js module with default export as content of the pdf as `string`. 
     */
    return {action: 'module'};
};

const config = {
    moduleResolution: 'relative',
    outDir: 'build/web_modules/',
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
        'css',
        'html',
        'image',
        'json',
        'txt',
        { text: /\.pdf$/g, handler: pdfHandler },
        { test: /\.xml$/g, moduleType: 'text'},
    ]
};
export default config;
```

# JSON Config file

 - for now the built-in plugin the oly pne supported.

```json
{
    "moduleResolution": "relative",
    "outDir": "public/web_modules/",
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

type ConfigPlugin = string| { text: /\.pdf$/g, handler: (importSyntax: ImportSyntax, relativeFilePath: string): PluginAction };

export interface JSConfig {
    outDir: string;
    src?: SourceInput;
    resources?: SourceInput;
    pathMap?: { [key: string]: string };
    extension?:  ".js" | ".mjs";
    moduleResolution?: 'relative' | 'static' | 'flat';
    baseUrl?: string;
    workspaceResolution?: 'all' | 'follow';
    plugins?: ConfigPlugin[];
}
```

## How to build A Plugin

- for now all built-in plugin intercepting only `import` statement, `export` statement not implemented yet.

```ts
class PluginAction { action: 'replace' | 'fetch' | 'module', inline?: string }
let pdfHandler = (importSyntax: ImportSyntax, relativeFilePath: string): PluginAction => {
    // write plugin for pdf files
    return {action: 'module'};
};

// provide a new plugin with the help of built-in plugin behavior.
let mdPluginHandler = new Plugin('text');
let pngImage = new Plugin('objectURL');

let config = {
    ...
    plugins: [
        'json',
        { test: /\.pdf$/g, handler: pdfHandler },
        { test: /\.xml$/g, moduleType: 'text' },
        { test: /\.md$/g}, handler: mdPluginHandler },
        { test: /\.png$/g, handler: pngImage }
    ]
}
```

`replace:` replace import statement with code.
`fetch`: replace the import statement with a fetch request code, from the inline.
`module`: convert the resource file to a js module, and import its default.
`inline`: hold code to be replaced with the import statement.
`moduleType` value could be: `text`, `json`, `blob`, `arrayBuffer`, `file`, `uint8`, `objectURL`, `base64` and `dataBase64`.

## Example 

`app/file.html`

```html
 <h1> Hello from HTML</h1>
```

`app/main-module.js`

```ts
import htmlContent, {url, promise, value} from './file1.html';

console.log(htmlContent);   // print undefined
console.log(value);          // print undefined
console.log(url);           // print 'http://site-url/{outDir}/app/file1.html'

promise.then(content => {
    console.log(htmlContent);   // print '<h1> Hello from HTML</h1>'
    console.log(value);          // print '<h1> Hello from HTML</h1>'
    console.log(content);       // print '<h1> Hello from HTML</h1>'

    console.log(content == htmlContent); // print true
    console.log(content == html);        // print true, the same object
})
.catch(reason => console.error('failed loading html file'));

```

`@aurora/esmpack` support operator `as` for renaming the default exported names in the wildcard

```ts
import json, {promise as jsonPromise} from './file.json';
import text, {promise as textPromise} from './file.txt';

import {url as imageUrl} from './image.jpg';

file1Promise.then(content => {
    ....
});

textPromise.then(content => {
    ....
});

```

`@aurora/esmpack` support operator `export` from a non-js file.

```ts
/// <reference types="@aurorats/types" />

export * from './file.json';
export * from './file.txt'; 
/**will throw error at runtime, 
 * keep aware of renaming wildcard binding names, so not conflict with each other.
 * Consider explicitly re-exporting to resolve the ambiguity
 */

export {url as imageUrl, jpg as imageObject} from './image.jpg';
export * as image from './image.jpg';
```

## TO:DO

 - set extension of module file to '.js' or '.mjs', currently, doesn't override filename.
 - moduleResolution `static` and `flat`: currently `relative` is supported
