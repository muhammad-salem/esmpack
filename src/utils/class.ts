
export interface ClassInfoType {

    /**
     * this plugin name
     */
    getName(): string;
    /**
     * RegExp patterns that applied on import lib-name,
     * import { some-thing } from 'lib-name';
     * 
     * import 'bootstrap/dist/css/bootstrap.min.css'
     * supportedModules() return /[\w|\\|\.]*.css/g
     */
    getRegExp(): RegExp;
}

export interface TypeOf<T> extends Function {
    new(...values: any): T;
}

export function ClassInfo(pluginName: string, regexp: RegExp, map?: Map<string, { regexp: RegExp, handler: any }>): Function {
    return (target: Function & ClassInfoType & TypeOf<ClassInfoType>): Function => {
        target.getName = () => pluginName;
        target.getRegExp = () => regexp;
        if (map) {
            map.set(pluginName, { regexp, handler: new target() });
        }
        return target;
    };
}

