let requestUrl: string, init: { [key: string]: any };

let __moduleDir__: string;

function __GetModuleDir() {
    return __moduleDir__;
}

function fetchTextWithPromise() {
    let importName: string;
    const promiseName: Promise<string> = new Promise<string>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.text())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}


function fetchJSONWithPromise() {
    let importName: { [key: string]: any };
    const promiseName: Promise<{ [key: string]: any }> = new Promise<{ [key: string]: any }>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.json())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchFormDataWithPromise() {
    let importName: FormData;
    const promiseName: Promise<FormData> = new Promise<FormData>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.formData())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchBlobWithPromise() {
    let importName: Blob;
    const promiseName: Promise<Blob> = new Promise<Blob>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.blob())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchBuffWithPromise() {
    let importName: ArrayBuffer;
    const promiseName: Promise<ArrayBuffer> = new Promise<ArrayBuffer>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchBufWithPromise() {
    let importName: Uint8Array;
    const promiseName: Promise<Uint8Array> = new Promise<Uint8Array>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => new Uint8Array(arrayBuffer))
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}


function fetchB64WithPromise() {
    let importName: string;
    const promiseName: Promise<string> = new Promise<string>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => new Uint8Array(arrayBuffer))
            .then(unit => unit.reduce((data, byte) => data + String.fromCharCode(byte), ''))
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}

function fetchImageWithPromise() {
    let importName: string;
    const promiseName: Promise<string> = new Promise<string>((resolve, reject) => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.blob())
            .then(blob => URL.createObjectURL(blob))
            .then(value => importName = value)
            .then(value => resolve(value))
            .catch(reason => reject(reason));
    });
}


type AudioType = { src: AudioBufferSourceNode, ctx: AudioContext, buff: ArrayBuffer };

function fetchAudioWithPromise() {
    let importName: AudioBufferSourceNode;
    const promiseName: Promise<AudioType> = new Promise<AudioType>((resolve, reject) => {
        let audioCtx = new AudioContext();
        importName = audioCtx.createBufferSource();
        let buff: ArrayBuffer;
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(buffer => {
                buff = buffer;
                audioCtx.decodeAudioData(buffer, decodedData => {
                    importName.buffer = decodedData;
                    importName.connect(audioCtx.destination);
                });
            })
            .then(() => resolve({ src: importName, ctx: audioCtx, buff: buff }))
            .catch(reason => reject(reason));
    });
}

function removeCode() {

}

export type FetchWithPromiseType =
    'arrayBuffer' |
    'blob' |
    'formData' |
    'json' |
    'text' |
    'image' |
    'audio' |
    'buff' |
    'buf' |
    'b64';

export function getBodyTypeCallback(bodyType?: FetchWithPromiseType): Function {
    switch (bodyType) {
        case 'text': return fetchTextWithPromise;
        case 'json': return fetchJSONWithPromise;
        case 'blob': return fetchBlobWithPromise;
        case 'formData': return fetchFormDataWithPromise;
        case 'image': return fetchImageWithPromise;
        case 'audio': return fetchAudioWithPromise;
        case 'buf': return fetchBufWithPromise;
        case 'b64': return fetchB64WithPromise;
        case 'buff':
        case 'arrayBuffer': return fetchBuffWithPromise;
        default: return removeCode;
    }
}

export function generateFetchWithPromise(injectType: FetchWithPromiseType, promiseName: string, url: string, importName: string = '', init?: { [key: string]: any }) {
    let inject = getBodyTypeCallback(injectType).toString();
    inject = inject.replace(/promiseName/gm, promiseName);
    if (importName) {
        inject = inject.replace(/importName/gm, importName);
    } else {
        // remove import statement;
        inject = inject.replace('let importName;', '');
        inject = inject.replace('.then(value => importName = value)', '');
    }
    inject = inject.replace(/requestUrl/gm, JSON.stringify(url));
    inject = inject.replace(/bodyType/gm, JSON.stringify(injectType));
    if (init) {
        inject = inject.replace(/init/gm, JSON.stringify(init));
    } else {
        inject = inject.replace(/, init/gm, '');
    }
    // let intent = 0;
    inject = inject.split('\n')
        .filter((value, index, arr) => index > 0 && index < arr.length - 1)
        .map(value => value.trim())
        .filter(value => value)
        .join('');
    return inject;
}
