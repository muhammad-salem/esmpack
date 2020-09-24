import { resolve } from 'path';
import { JSTransformer } from '../resolution/transform.js';
import { mkdirSyncIfNotExists, trackNodeModulePath, trackPackage } from '../utils/utils.js';
import { ESMConfig } from './config.js';
import { getPackageInfo, PackageInfo, PackageJson } from './package-info.js';

import { GlopSourceInput } from './source-input.js';
import {
    PackageTransformerHandler, WorkspaceTransformerHandler, TransformerHandler
} from '../resolution/package.js';
import { copyFileSync, existsSync } from 'fs';
import { logger } from '../logger/logger.js';


export class ESMTransformer {

    provider = new Map<string, PackageInfo>();
    nodeModulePath: string;

    workspaceTransformer: TransformerHandler;
    packageTransformer: TransformerHandler;


    source: GlopSourceInput;
    resources: GlopSourceInput;
    workspacePackage: PackageInfo;
    jsTransformer: JSTransformer;

    constructor(public config: ESMConfig, public cwd: string) {
        this.workspaceTransformer = new WorkspaceTransformerHandler(config);
        this.packageTransformer = new PackageTransformerHandler(config);
        this.initService();
    }

    addToProvider(provider: Map<string, PackageInfo>, pkgJson: PackageJson, nodeModulePath: string, outDir: string) {
        if (!pkgJson.dependencies) {
            return;
        }
        Object.keys(pkgJson.dependencies).forEach(name => {
            let pkgTrack = trackPackage(name, nodeModulePath);
            if (pkgTrack) {
                if (!provider.has(pkgTrack.packageName)) {
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

    copyResourcesToSource(resources: string[], pkgInfo: PackageInfo) {
        logger.info(`copy workspace resources: '${pkgInfo.getName()}'.`);
        resources.forEach(path => {
            let outPath = pkgInfo.resolveSrc(path);
            Object.keys(this.config.pathMap || {}).forEach(key => {
                outPath = outPath.replace(key, this.config.pathMap[key]);
            });
            if (existsSync(path)) {
                mkdirSyncIfNotExists(resolve(outPath, '..'));
                copyFileSync(path, outPath);
            }
        });
    }

    initService() {
        logger.debug(`init esmpack services.`);
        this.nodeModulePath = trackNodeModulePath(this.cwd);
        if (!this.nodeModulePath) {
            logger.exception("couldn't found node_module, please run npm install.");
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
            if (!dependency.isTransformed) {
                if (!this.config.prod) {
                    logger.debug(`copying dependency: '${dependency.getName()}' files to output dir.`);
                    dependency.copyFiles();
                }
                logger.info(`start transform '${dependency.getName()}'.`);
                this.packageTransformer.handle(dependency.srcIndex(), dependency.outIndex(), {
                    jsTransformer: this.jsTransformer,
                    nodeModulePath: this.nodeModulePath,
                    packageInfo: dependency,
                    plugins: this.config.plugins,
                    outDir: this.config.outDir,
                    provider: this.provider
                });
                dependency.isTransformed = true;
                logger.info(`done transform '${dependency.getName()}'.`);
            }
        });
    }

    transformWorkspace() {
        if (!this.config.prod) {
            logger.info(`copying workspace '${this.workspacePackage.getName()}' files to output dir.`);
            this.workspacePackage.copyFiles();
        }
        this.copyResourcesToSource(this.resources.getFiles(), this.workspacePackage);
        logger.info(`start transform workspace '${this.workspacePackage.getName()}'.`);
        this.source.getFiles().forEach(path => {
            logger.info(`transform '${path}'.`);
            this.workspaceTransformer.handle(path, this.workspacePackage.resolveOut(path), {
                jsTransformer: this.jsTransformer,
                nodeModulePath: this.nodeModulePath,
                packageInfo: this.workspacePackage,
                plugins: this.config.plugins,
                outDir: this.config.outDir,
                provider: this.provider
            });
        });
        this.workspacePackage.isTransformed = true;
        logger.info(`done transform workspace'${this.workspacePackage.getName()}'.`);
    }

    watch() {
        logger.info(`watch is not supported now.`);
    }

    watchForPackage() {
        logger.info(`watch is not supported now.`);
    }
}



