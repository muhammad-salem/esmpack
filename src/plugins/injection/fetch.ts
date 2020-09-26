let requestUrl: string, init: { [key: string]: any };

let __moduleDir__: string;

function __GetModuleDir() {
    return __moduleDir__;
}

/**
 * import formData from '/request/url/file-name.txt, css, any text format';
 */
function fetchText() {
    let importName: string;
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.text())
            .then(value => importName = value);
    })();
}

/**
 * import formData from '/request/url/file-name.json';
 */
async function fetchJSON() {
    let importName: { [key: string]: any };
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.json())
            .then(value => importName = value);
    })();
}

/**
 * import formData from '/api/request/url.formData';
 */
async function fetchFormData() {
    let importName: FormData;
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.formData())
            .then(value => importName = value);
    })();
}

/**
 * import formData from '/api/request/url.formData/dyn';
 */
// async function importFormDataDynamic() {
// 	const importName = fetch(requestUrl, init).then(response => response.formData());
// }

/**
 * import formData from '/filename.ext.blob';
 */
async function fetchBlob() {
    let importName: Blob;
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.blob())
            .then(value => importName = value);
    })();
}


/**
 * import formData from '/filename.ext.buff';
 */
async function fetchBuff() {
    let importName: ArrayBuffer;
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(value => importName = value);
    })();
}

/**
 * import formData from '/filename.ext.buf';
 */
async function fetchBuf() {
    let importName: Uint8Array;
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => new Uint8Array(arrayBuffer))
            .then(value => importName = value);
    })();
}

/**
 * import formData from '/filename.ext.b64';
 */
async function fetchB64() {
    let importName: string;
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => new Uint8Array(arrayBuffer))
            .then(unit => unit.reduce((data, byte) => data + String.fromCharCode(byte), ''))
            .then(value => importName = value);
    })();
}

/**
 * import formData from '/flowers.jpg';
 */
async function fetchImage() {
    let importName: string;
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.blob())
            .then(blob => URL.createObjectURL(blob))
            .then(value => importName = value);
    })();
}

async function fetchAudio() {
    const importName = (() => {
        let audioCtx = new AudioContext();
        const source = audioCtx.createBufferSource();
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => {
                if (!response.ok) {
                    throw new Error("HTTP error, status = " + response.status + ' url: ' + requestUrl);
                }
                return response.arrayBuffer();
            })
            .then(buffer => {
                audioCtx.decodeAudioData(buffer, decodedData => {
                    source.buffer = decodedData;
                    source.connect(audioCtx.destination);
                });
            });
        return source;
    })();
}

function removeCode() {

}

export type FetchType = 'arrayBuffer' |
    'blob' |
    'formData' |
    'json' |
    'text' |
    'image' |
    'audio' |
    'buff' |
    'buf' |
    'b64';


export function getFetchCallback(bodyType?: FetchType): Function {
    switch (bodyType) {
        case 'buff':
        case 'arrayBuffer': return fetchBuff;
        case 'buf': return fetchBuf;
        case 'blob': return fetchBlob;
        case 'formData': return fetchFormData;
        case 'json': return fetchJSON;
        case 'image': return fetchImage;
        case 'audio': return fetchAudio;
        case 'b64': return fetchB64;
        case 'text': return fetchText;
        default: return removeCode;
    }
}

export function generateFetch(bodyType: FetchType, importName: string, url: string, init?: { [key: string]: any }) {
    let inject = getFetchCallback(bodyType).toString();
    inject = inject.replace(/importName/gm, importName);
    inject = inject.replace(/requestUrl/gm, JSON.stringify(url));
    if (!bodyType) {
        bodyType = 'text';
    }
    inject = inject.replace(/bodyType/gm, JSON.stringify(bodyType));
    if (init) {
        inject = inject.replace(/init/gm, JSON.stringify(init));
    } else {
        inject = inject.replace(/, init/gm, '');
    }
    inject = inject.split('\n')
        .filter((value, index, arr) => index > 0 && index < arr.length - 1)
        .map(value => value.trim())
        .filter(value => value)
        .join('');
    return inject;
}
