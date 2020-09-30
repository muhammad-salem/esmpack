import { Dir, existsSync, lstatSync, mkdirSync, readdirSync } from 'fs';
import { resolve, sep } from 'path';

export function isContainNodePackage(dir: Dir | string) {
    let path = dir instanceof Dir ? dir.path : dir;
    return existsSync(path) && existsSync((path = resolve(path, 'package.json'))) && path;
}

export function isNodeModule(dir: Dir | string) {
    let path = dir instanceof Dir ? dir.path : dir;
    return existsSync(path)
        && (path.endsWith(sep + 'node_modules') || path.endsWith(sep + 'node_modules' + sep));
}

export function isContainNodeModule(dir: Dir | string) {
    let path = dir instanceof Dir ? dir.path : dir;
    return existsSync(path) && existsSync((path = path + sep + 'node_modules')) && path;
}

export function getJSModuleFilePath(importPath: string): string | undefined {
    if (importPath.endsWith('.js') || importPath.endsWith('.mjs')) {
        if (existsSync(importPath)) {
            return importPath;
        }
    }
    return getJSModuleFilePath(importPath + '.js') || getJSModuleFilePath(importPath + '.mjs');
}

export type TrackPackageType = {
    nodeModulePath: string;
    packageName: string;
    packagePath: string;
    subPath?: string;
};

export function isNodeModuleDirEmpty(path: string) {
    let dirs = readdirSync(path);
    if (dirs.length === 0) {
        return true;
    } else if (dirs.length === 1 && dirs[0] === '.bin') {
        return true
    }
    return false;
}
export function trackNodeModulePath(cwd: string): string {
    let path = isContainNodeModule(cwd);
    if (path) {
        if (isNodeModuleDirEmpty(path)) {
            cwd = resolve(cwd, '..');
        } else {
            return path;
        }
    } else if (cwd === sep) {
        return '';
    }
    return trackNodeModulePath(resolve(cwd, '..'));
}

export function trackPackage(pkgName: string, nodeModulePath: string = ''): TrackPackageType | undefined {
    let packagePath = resolve(nodeModulePath, pkgName);
    let path = isContainNodePackage(packagePath);
    if (path) {
        return {
            packageName: pkgName,
            packagePath: path,
            nodeModulePath
        };
    }

    let subPath = pkgName.substring(pkgName.lastIndexOf('/') + 1);
    pkgName = pkgName.substring(0, pkgName.lastIndexOf('/'));
    if (pkgName === '') {
        return;
    }
    let pkg = trackPackage(pkgName, nodeModulePath);
    if (pkg) {
        pkg.subPath = pkg.subPath ? (pkg.subPath + '/' + subPath) : subPath;
        return pkg;
    }
}

export function resolveTrackPackagePath(pkgTrack: TrackPackageType) {
    return resolve(pkgTrack.nodeModulePath, pkgTrack.packageName, pkgTrack.subPath as string);
}

export function mkdirSyncIfNotExists(path: string) {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}

export function matchFileExtension(filePath: string) {
    return (/\.([^\/]+)$/g).exec(filePath);
}

export function getFileExtension(filePath: string) {
    let ext = matchFileExtension(filePath);
    if (ext) {
        return ext[1];
    }
}

export function isDirectory(path: string) {
    return existsSync(path) && lstatSync(path).isDirectory();
}

export function isFile(path: string) {
    return existsSync(path) && lstatSync(path).isFile();
}
