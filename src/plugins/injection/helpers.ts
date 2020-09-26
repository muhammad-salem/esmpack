let requestUrl: string, init: { [key: string]: any };

let __moduleDir__: string;

function __GetModuleDir() {
	return __moduleDir__;
}

function defineModuleDirDev() {
	var __moduleDir__: string;
	function __GetModuleDir() {
		return __moduleDir__ || (__moduleDir__ = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1));
	}
}

function defineModuleDirProd() {
	const __moduleDir__ = import.meta.url.substring(0, import.meta.url.lastIndexOf('/') + 1);
	function __GetModuleDir() {
		return __moduleDir__;
	}
}


function removeCode() {

}

export type HelperType = 'define:dev' | 'define:prod';

export function getHelperTypeCallback(helperType?: HelperType): Function {
	switch (helperType) {
		case 'define:dev': return defineModuleDirDev;
		case 'define:prod': return defineModuleDirProd;
		default: return removeCode;
	}
}

export function generateHelper(helperType: HelperType) {
	let inject = getHelperTypeCallback(helperType).toString();
	inject = inject.replace(/bodyType/gm, JSON.stringify(helperType));
	if (init) {
		inject = inject.replace(/init/gm, JSON.stringify(init));
	} else {
		inject = inject.replace(/, init/gm, '');
	}
	inject = inject.split('\n')
		.filter((value, index, arr) => index > 0 && index < arr.length - 1)
		.map(value => value.trim())
		.join('');
	return inject;
}
