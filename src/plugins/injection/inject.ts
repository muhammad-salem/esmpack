let requestUrl: string, init: { [key: string]: any };

let __moduleDir__: string;

function __GetModuleDir() {
    return __moduleDir__;
}

function injectStyle() {
    (function () {
        fetch(__GetModuleDir() + requestUrl, init)
            .then(response => response.text())
            .then(response => {
                const style = document.createElement('style');
                style.textContent = response;
                document.head.append(style);
            });
    })();
}

function removeCode() {

}

export type InjectType = 'style';


export function getInjectCallback(injectType?: InjectType): Function {
    switch (injectType) {
        case 'style': return injectStyle;
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
