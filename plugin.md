# Aurora Types

aurora types, this project provide a wildcard modules helper to import different non-js files to a typescript project as a module.

With the help of `@aurora/esmpack` can provide some functionality to these modules. 
by replacing the import/export statement itself, with the required code.

`Bindings imported are called live bindings because they are updated by the module that exported the binding.` 
the esmpack will fetch the data, not inject it to the js module. so, while fetching, the object with be `undefined`.

## `Install`

``` bash
npm i --save @aurorats/types
```

``` bash
yarn add @aurorats/types
```

## *Wildcard Structural

```ts
declare module '*.html' {
    export default html;
    export const html: string;
    export const url: string;
    export const promise: Promise<string>;
}
```
 - `export default html; export const html: string;` : 
the module has default import as the content of the file itself and export const as the file extension. while the js module is executing, the `html` is `undefined`, after a `fetch` request done with no error, the variable `html` will be defined, with the date. 
 - `export const url: string;` the url of imported/exported file(as module) at runtime (browser).

 - `export const promise: Promise<string>;` a promise to be notified when the data had been loaded successfully.


 ## Example 

 `app/file.html`

 ```html
 <h1> Hello from HTML</h1>
 ```

 `app/main-module.js`

 ```ts
import htmlContent, {url, promise, html} from './file1.html';

console.log(htmlContent);   // print undefined
console.log(html);          // print undefined
console.log(url);           // print 'http://site-url/app/file1.html'

promise.then(content => {
    console.log(htmlContent);   // print '<h1> Hello from HTML</h1>'
    console.log(html);          // print '<h1> Hello from HTML</h1>'
    console.log(content);       // print '<h1> Hello from HTML</h1>'

    console.log(content == htmlContent); // print true
    console.log(content == html);        // print true, the same object
});

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
export * from './file.json'; 
export * from './file.txt'; 
/**will throw error at runtime, 
 * keep aware of renaming wildcard binding names, to not conflict with each other.
 */


export {url as imageUrl, jpg as imageObject} from './image.jpg';
/**
 * the host js module, with be the exporter
 */


file1Promise.then(content => {
    ....
});

textPromise.then(content => {
    ....
});

 ```

