import { copyFileSync } from 'fs';
import { relative, resolve, sep } from 'path';
import { readJSON } from '../utils/reader.js';
import { isFile, mkdirSyncIfNotExists } from '../utils/utils.js';
import { SourceInput } from './config.js';
import { GlopSourceInput } from './source-input.js';

export interface ESMPackageConfig {
    buildDir: string;
    packagePath: string;
    watch: boolean;
    nodeModulePath: string;
}

export interface PackageJson {

    name: string;
    version: string;
    description: string;
    type: string;
    main: string;
    browser: string;
    module: string;
    esm2015: string;
    es2015: string;
    es2015_ivy_ngcc: string;
    fesm2015_ivy_ngcc: string;
    fesm2015: string;
    "jsnext:main": string;
    style: string;

    types: string;
    "typings": string;
    repository: string;
    license: string;
    dependencies: { [key: string]: string };
    peerDependencies: { [key: string]: string };
    devDependencies: { [key: string]: string };
    sideEffects: boolean;

}

export class PackageInfo {
    isTransformed: boolean = false;
    // files: string[];
    constructor(
        public packageModel: PackageJson,
        public src: string,
        public out: string,
        public index: string,
        public isModule: boolean = false) {

    }
    copyFiles() {
        let buildDir: string = relative(this.src, this.out);
        let slash = buildDir.indexOf('/');
        if (slash > 0) {
            buildDir = buildDir.substring(0, slash);
        }
        let srcInput: SourceInput = {
            include: [this.src + '/**/*'],
            exclude: [
                this.src + '/node_modules/**/*',
                this.src + '/' + buildDir + '/**/*'
            ],
            files: []
        };
        let files = new GlopSourceInput(srcInput).getFiles();
        files.forEach(file => {
            let out = file.replace(this.src, '.');
            out = this.resolveOut(out);
            if (isFile(file)) {
                mkdirSyncIfNotExists(resolve(out, '..'));
                copyFileSync(file, out);
            }
        });
    }
    getName() {
        return this.packageModel.name;
    }
    resolveIndex(outputPath: string): string {
        return resolve(outputPath, this.index);
    }
    resolveSrc(outputPath: string): string {
        return resolve(this.src, outputPath);
    }
    resolveOut(outputPath: string): string {
        return resolve(this.out, outputPath);
    }
    srcIndex() {
        return this.resolveIndex(this.src);
    }
    outIndex() {
        return this.resolveIndex(this.out);
    }
    relativeSrc(outputPath: string): string {
        return relative(outputPath, this.srcIndex());
    }
    relativeOut(outputPath: string): string {
        return relative(outputPath, this.outIndex());
    }
    resolveSubPackage(outputPath: string, subPath: string): string {
        let sub = resolve(subPath, this.index);
        return relative(outputPath, sub);
    }
    resolveInternalPackage(outputPath: string, internalPath: string, subPath?: string): string {
        let sub = resolve(internalPath, this.out);
        if (subPath) {
            sub += sep + subPath;
        }
        return relative(outputPath, sub);
    }
}

export function isContainModule(pkg: PackageJson) {
    return (pkg.esm2015 || pkg['jsnext:main'] || pkg.module || pkg.type === 'module') ? true : false;
}

export function getPackageIndex(pkg: PackageJson) {
    return pkg.esm2015 || pkg['jsnext:main'] || pkg.module || pkg.main || pkg.browser || 'index.js';
}

export function getPackageInfo(packagePath: string, buildDir: string): PackageInfo {
    let pkg: PackageJson = readJSON<PackageJson>(packagePath);
    let inputFile = getPackageIndex(pkg);
    let isModule = isContainModule(pkg);
    let root = resolve(packagePath, '..');
    let out = resolve(buildDir, pkg.name);
    let info = new PackageInfo(pkg, root, out, inputFile, isModule);
    return info;
}
