let requestUrl: string, init: { [key: string]: any };

let __moduleDir__: string;

function __GetModuleDir() {
    return __moduleDir__;
}

function fetchStyle() {
    (() => {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.text())
            .then(response => {
                const style = document.createElement('style');
                style.textContent = response;
                document.head.append(style);
            });
    })();
}

function loadStyle() {
    (() => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = __GetModuleDir() + requestUrl;
        document.head.append(link);
    })();
}

function removeCode() {

}

export type InjectType = 'fetch:style' | 'load:style';


export function getInjectCallback(injectType?: InjectType): Function {
    switch (injectType) {
        case 'fetch:style': return fetchStyle;
        case 'load:style': return loadStyle;
        default: return removeCode;
    }
}

export function generateInject(injectType: InjectType, url: string, init?: { [key: string]: any }) {
    let inject = getInjectCallback(injectType).toString();
    inject = inject.replace(/requestUrl/gm, JSON.stringify(url));
    inject = inject.replace(/bodyType/gm, JSON.stringify(injectType));
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
