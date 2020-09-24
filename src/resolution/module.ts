
export interface ModuleResolution {
    /**
     * 
     * @param packageName the name of the package.
     * @param modulePath the path of js module in that package.
     * @param baseUrl if available, to be requested from web-server
     */
    resolve(packageName: string, modulePath: string, baseUrl?: string): string;
}

export class FlatModuleResolution implements ModuleResolution {
    resolve(packageName: string, modulePath: string): string {
        let path = packageName + '/' + modulePath;
        path = path.replace(/\//g, '.');
        return path;
    }
}

export class RelativeModuleResolution implements ModuleResolution {
    resolve(packageName: string, modulePath: string): string {
        return packageName + '/' + modulePath;
    }
}

export class StaticModuleResolution implements ModuleResolution {
    resolve(packageName: string, modulePath: string, baseUrl: string): string {
        return baseUrl + '/' + packageName + '/' + modulePath;
    }
}