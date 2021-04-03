import { resolve } from 'path';
import chokidar from 'chokidar';
import { JSTransformer } from '../resolution/transform.js';
import { isFile, mkdirSyncIfNotExists, trackNodeModulePath, trackPackage } from '../utils/utils.js';
import { ESMConfig } from './config.js';
import { getPackageInfo, PackageInfo, PackageJson } from './package-info.js';

import { GlopSourceInput } from './source-input.js';
import { TransformerHandler } from '../resolution/package.js';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { logger } from '../logger/logger.js';


export class ESMTransformer {

    provider = new Map<string, PackageInfo>();
    nodeModulePath: string;
    mapKeys: string[];
    source: GlopSourceInput;
    resources: GlopSourceInput;
    workspacePackage: PackageInfo;
    jsTransformer: JSTransformer;
    transformerHandler: TransformerHandler;

    constructor(public readonly config: ESMConfig, public readonly cwd: string) {
        this.transformerHandler = new TransformerHandler(config);
        this.initService();
        this.mapKeys = Object.keys(this.config.pathMap || {});
    }

    addToProvider(provider: Map<string, PackageInfo>, pkgJson: PackageJson, nodeModulePath: string, outDir: string) {
        if (!pkgJson.dependencies) {
            return;
        }
        let modules = Object.keys(pkgJson.dependencies);
        if (pkgJson.peerDependencies) {
            modules = modules.concat(Object.keys(pkgJson.peerDependencies));
        }
        modules.forEach(name => {
            if (!provider.has(name)) {
                let pkgTrack = trackPackage(name, nodeModulePath);
                if (pkgTrack) {
                    if (pkgTrack.packagePath) {
                        let info = getPackageInfo(pkgTrack.packagePath, outDir);
                        provider.set(name, info);
                        logger.debug(`add package: '${info.getName()}' to providers`);
                        this.addToProvider(provider, info.packageModel, pkgTrack.nodeModulePath, outDir);
                    }
                }
            }
        });
    }

    copyResourcesToSource(resources: string[]) {
        if (this.mapKeys.length === 0) {
            return;
        }
        resources
            .filter(path => isFile(path))
            .forEach(path => this.copyResourcesFile(path));
    }

    private copyResourcesFile(path: string) {
        let outPath = this.workspacePackage.resolveSrc(path);
        this.mapKeys.forEach(key => {
            outPath = outPath.replace(key, this.config.pathMap[key]);
        });
        mkdirSyncIfNotExists(resolve(outPath, '..'));
        copyFileSync(path, outPath);
    }

    private deleteResourcesFile(path: string) {
        let outPath = this.workspacePackage.resolveSrc(path);
        if (existsSync(outPath)) {
            unlinkSync(outPath);
        }
    }

    initService() {
        logger.debug(`init esmpack services.`);
        this.nodeModulePath = trackNodeModulePath(this.cwd);
        if (!this.nodeModulePath) {
            throw new Error("couldn't found node_module, please run npm install.");
        }
        this.source = new GlopSourceInput(this.config.src);
        this.resources = new GlopSourceInput(this.config.resources);
        this.workspacePackage = getPackageInfo(resolve(this.cwd, 'package.json'), this.config.outDir);

        this.jsTransformer = new JSTransformer();
        this.config.plugins ||= [];

        logger.info(`search workspace for dependencies.`);
        this.addToProvider(this.provider, this.workspacePackage.packageModel, this.nodeModulePath, this.config.outDir);
    }

    transformDependencies() {
        this.provider.forEach(dependency => {
            if (!dependency.transformed) {
                if (!this.config.prod) {
                    logger.debug(`copying dependency: '${dependency.getName()}' files to output dir.`);
                    dependency.copyFiles();
                }
                logger.info(`transforming '${dependency.getName()}'...`);
                this.transformerHandler.handle(dependency.srcIndex(), dependency.outIndex(), {
                    jsTransformer: this.jsTransformer,
                    nodeModulePath: this.nodeModulePath,
                    packageInfo: dependency,
                    plugins: this.config.plugins,
                    outDir: this.config.outDir,
                    provider: this.provider
                });
                dependency.transformed = true;
            }
        });
    }

    transformWorkspace() {
        if (!this.config.prod) {
            logger.info(`copying workspace '${this.workspacePackage.getName()}' files to output dir.`);
            this.workspacePackage.copyFiles();
        }
        logger.info(`copy workspace resources: '${this.workspacePackage.getName()}'.`);
        this.copyResourcesToSource(this.resources.getFiles());
        logger.info(`start transform workspace '${this.workspacePackage.getName()}'.`);
        let transformedFiles: string[] = [];
        this.source.getFiles().forEach(path => {
            if (transformedFiles.includes(path)) {
                return;
            }
            logger.info(`transform '${path}'.`);
            this.transformWorkspaceFile(path, transformedFiles);
        });
        this.workspacePackage.transformed = true;
        logger.info(`done transform workspace'${this.workspacePackage.getName()}'.`);
    }

    private transformWorkspaceFile(path: string, transformedFiles?: string[]) {
        this.transformerHandler.handle(path, this.workspacePackage.resolveOut(path), {
            jsTransformer: this.jsTransformer,
            nodeModulePath: this.nodeModulePath,
            packageInfo: this.workspacePackage,
            plugins: this.config.plugins,
            outDir: this.config.outDir,
            provider: this.provider
        }, transformedFiles);
    }

    watch() {
        // setup watcher for js files
        this.watchSource();
        this.watchResource();
    }

    private watchSource() {
        const watcher = chokidar.watch(this.config.src.include, {
            ignored: this.config.src.exclude,
            persistent: true
        });

        watcher.add(this.config.src.files);
        watcher
            .on('ready', () => logger.info('Initial scan complete. Ready for changes'))
            .on('add', (path, stats) => {
                logger.info(`'${path}' added, transforming.`);
                this.transformWorkspaceFile(path);
            })
            .on('change', (path, stats) => {
                logger.info(`'${path}' added, transforming.`);
                this.transformWorkspaceFile(path);
            })
            .on('unlink', path => {
                logger.info(`File ${path} has been removed`);
                let outPath = this.workspacePackage.resolveOut(path);
                if (existsSync(outPath)) {
                    unlinkSync(outPath);
                }
            });
    }

    private watchResource() {

        const watcher = chokidar.watch(this.config.resources.include, {
            ignored: this.config.resources.exclude,
            persistent: true
        });

        watcher.add(this.config.resources.files);
        watcher
            .on('add', (path, stats) => {
                logger.info(`copy file: '${path}'`);
                this.copyResourcesFile(path);
            })
            .on('change', (path, stats) => {
                logger.info(`copy file: '${path}'`);
                this.copyResourcesFile(path);
            })
            .on('unlink', path => {
                logger.info(`File ${path} has been removed`);
                this.deleteResourcesFile(path);
            });
    }

    watchForPackage() {
        logger.info(`watch form package is not supported yet.`);
    }
}



