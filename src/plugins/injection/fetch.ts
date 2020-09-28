import { ImportSyntax } from '../../resolution/transform.js';

let requestUrl: string, init: { [key: string]: any };

let __moduleDir__: string;

function __GetModuleDir() {
    return __moduleDir__;
}

function defineUrlOnly() {
    const importURL: string = __GetModuleDir() + requestUrl;
}
function fetchText() {
    let importName: string;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<string> = new Promise<string>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.text())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}


function fetchJSON() {
    let importName: { [key: string]: any };
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<{ [key: string]: any }> = new Promise<{ [key: string]: any }>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.json())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchFormData() {
    let importName: FormData;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<FormData> = new Promise<FormData>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.formData())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchBlobW() {
    let importName: Blob;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<Blob> = new Promise<Blob>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.blob())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchArrayBuffer() {
    let importName: ArrayBuffer;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<ArrayBuffer> = new Promise<ArrayBuffer>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchUint8Array() {
    let importName: Uint8Array;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<Uint8Array> = new Promise<Uint8Array>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => new Uint8Array(arrayBuffer))
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchBase64() {
    let importName: string;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<string> = new Promise<string>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.text())
            .then(text => btoa(text))
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchDataBase64() {
    let importName: string;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<string> = new Promise<string>((resolve, reject) => {
        let type: string;
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => { type = response.type; return response.text(); })
            .then(text => `data:${type};base64,${btoa(text)}`)
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchObjectURL() {
    let importName: string;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<string> = new Promise<string>((resolve, reject) => {
        let objectURL: string;
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.blob())
            .then(blob => URL.createObjectURL(blob))
            .then(value => importName = value)
            .then(value => objectURL = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
        window.addEventListener('unload', () => { URL.revokeObjectURL(objectURL); });
    });
}

function fetchFile() {
    let importName: File;
    const importURL: string = __GetModuleDir() + requestUrl;
    const promiseName: Promise<File> = new Promise<File>((resolve, reject) => {
        let url = __GetModuleDir() + requestUrl;
        let fileName = url.substring(url.lastIndexOf('/') + 1);
        fetch(url, init)
            .then(response => response.blob())
            .then(blob => new File([blob], fileName))
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

// function removeCode() {

// }

export type FetchType =
    'text' |
    'json' |
    'blob' |
    'arrayBuffer' |
    'formData';

export type MarkType =
    'file' |
    'uint8' |
    'objectURL' |
    'base64' |
    'dataBase64';

export function getFetchTypeFunction(fetchType?: FetchType | MarkType): Function {
    switch (fetchType) {
        case 'text': return fetchText;
        case 'json': return fetchJSON;
        case 'blob': return fetchBlobW;
        case 'formData': return fetchFormData;
        case 'arrayBuffer': return fetchArrayBuffer;
        case 'objectURL': return fetchObjectURL;
        case 'file': return fetchFile;
        case 'base64': return fetchBase64;
        case 'dataBase64': return fetchDataBase64;
        case 'uint8': return fetchUint8Array;
        default: {
            throw new Error(`${fetchType} is not supported`);
            // return removeCode;
        };
    }
}

export type RequestOpt = { [key: string]: any };

export function generateFetch(fetchType: FetchType | MarkType, url: string, importName: string = '', importURL: string = '', promiseName: string = '', init?: RequestOpt) {
    let injectCode: string;
    if (importURL && !importName && !promiseName) {
        injectCode = defineUrlOnly.toString();
    } else {
        injectCode = getFetchTypeFunction(fetchType).toString();
    }
    if (importName) {
        injectCode = injectCode.replace(/importName/gm, importName);
    } else {
        injectCode = injectCode.replace('let importName;', '');
        injectCode = injectCode.replace('.then(value => importName = value)', '');
    }

    if (importURL) {
        injectCode = injectCode.replace(/importURL/gm, importURL);
    } else {
        injectCode = injectCode.replace('const importURL = __GetModuleDir() + requestUrl;', '');
    }
    if (promiseName) {
        injectCode = injectCode.replace(/promiseName/gm, promiseName);
    } else {
        injectCode = injectCode.replace('const promiseName = ', '');
    }

    injectCode = injectCode.replace(/requestUrl/gm, JSON.stringify(url));
    if (!init) {
        init = { cache: 'force-cache' };
    }
    injectCode = injectCode.replace(/init/gm, JSON.stringify(init));
    // injectCode = injectCode.replace(/, init/gm, '');
    injectCode = injectCode.split('\n')
        .filter((value, index, arr) => index > 0 && index < arr.length - 1)
        .map(value => value.trim())
        .filter(value => value)
        .join('');
    return injectCode;
}


export function generateFetchFor(url: string, importSyntax: ImportSyntax, defaultFetchType: FetchType | MarkType, init?: RequestOpt) {
    let importName: string, importURL: string, promiseName: string;
    let bindingNames = importSyntax.getAllExportNames();
    promiseName = bindingNames.find(bind => bind.isPromise())?.getName() || '';
    importURL = bindingNames.find(bind => bind.isURL())?.getName() || '';
    importName = bindingNames.find(bind => bind.isDefaultOrValue())?.getName() || '';
    return generateFetch(importSyntax.markType() || defaultFetchType, url, importName, importURL, promiseName, init);
}

export function generateFetchAll(fetchType: FetchType | MarkType, url: string, aliasName: string, init?: RequestOpt) {
    let injectCode = getFetchTypeFunction(fetchType).toString();

    injectCode = injectCode.replace('let importName;', '');
    injectCode = injectCode.replace('importName = value', `${aliasName}.value = value`);
    injectCode = injectCode.replace('const importURL = ', `${aliasName}.url = `);
    injectCode = injectCode.replace('const promiseName = ', `${aliasName}.promise =`);

    injectCode = injectCode.replace(/requestUrl/gm, JSON.stringify(url));
    injectCode = injectCode.replace(/requestUrl/gm, JSON.stringify(url));
    if (!init) {
        init = { cache: 'force-cache' };
    }
    injectCode = injectCode.replace(/init/gm, JSON.stringify(init));
    injectCode = injectCode.split('\n')
        .filter((value, index, arr) => index > 0 && index < arr.length - 1)
        .map(value => value.trim())
        .filter(value => value)
        .join('');


    injectCode = `const ${aliasName} = {}; (() => {${injectCode}})()`;
    return injectCode;
}

export function generateFetchAllAndDefault(fetchType: FetchType | MarkType, url: string, aliasName: string, defaultName: string, init?: RequestOpt) {
    let injectCode = getFetchTypeFunction(fetchType).toString();
    injectCode = injectCode.replace('let importName;', `let ${defaultName};`);
    injectCode = injectCode.replace('importName = value', `${aliasName}.value = ${defaultName} = value`);
    injectCode = injectCode.replace('const importURL = ', `${aliasName}.url = `);
    injectCode = injectCode.replace('const promiseName = ', `${aliasName}.promise =`);

    injectCode = injectCode.replace(/requestUrl/gm, JSON.stringify(url));
    if (init) {
        injectCode = injectCode.replace(/init/gm, JSON.stringify(init));
    } else {
        injectCode = injectCode.replace(/, init/gm, '');
    }
    injectCode = injectCode.split('\n')
        .filter((value, index, arr) => index > 0 && index < arr.length - 1)
        .map(value => value.trim())
        .filter(value => value)
        .join('');


    injectCode = `const ${aliasName} = {}; (() => {${injectCode}})()`;
    return injectCode;
}