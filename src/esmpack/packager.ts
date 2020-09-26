import { resolve } from 'path';
import { JSTransformer } from '../resolution/transform.js';
import { isFile, mkdirSyncIfNotExists, trackNodeModulePath, trackPackage } from '../utils/utils.js';
import { ESMConfig } from './config.js';
import { getPackageInfo, PackageInfo, PackageJson } from './package-info.js';

import { GlopSourceInput } from './source-input.js';
import { TransformerHandler } from '../resolution/package.js';
import { copyFileSync } from 'fs';
import { logger } from '../logger/logger.js';


export class ESMTransformer {

    provider = new Map<string, PackageInfo>();
    nodeModulePath: string;

    // workspaceTransformer: TransformerHandler;
    // packageTransformer: TransformerHandler;
    transformerHandler: TransformerHandler;


    source: GlopSourceInput;
    resources: GlopSourceInput;
    workspacePackage: PackageInfo;
    jsTransformer: JSTransformer;

    constructor(public config: ESMConfig, public cwd: string) {
        // this.workspaceTransformer = new WorkspaceTransformerHandler(config);
        // this.packageTransformer = new PackageTransformerHandler(config);
        this.transformerHandler = new TransformerHandler(config);
        this.initService();
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

    copyResourcesToSource(resources: string[], pkgInfo: PackageInfo) {
        logger.info(`copy workspace resources: '${pkgInfo.getName()}'.`);
        let mapKeys = Object.keys(this.config.pathMap || {});
        if (mapKeys.length === 0) {
            return;
        }
        resources.filter(path => isFile(path))
            .forEach(path => {
                let outPath = pkgInfo.resolveSrc(path);
                mapKeys.forEach(key => {
                    outPath = outPath.replace(key, this.config.pathMap[key]);
                });
                mkdirSyncIfNotExists(resolve(outPath, '..'));
                copyFileSync(path, outPath);
            });
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
            if (!dependency.isTransformed) {
                if (!this.config.prod) {
                    logger.debug(`copying dependency: '${dependency.getName()}' files to output dir.`);
                    dependency.copyFiles();
                }
                logger.info(`start transform '${dependency.getName()}'.`);
                this.transformerHandler.handle(dependency.srcIndex(), dependency.outIndex(), {
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

    // private getWorkspaceTransformer(): TransformerHandler {
    //     if (this.config.workspaceResolution === 'follow') {
    //         return this.packageTransformer;
    //     }
    //     return this.workspaceTransformer;
    // }

    transformWorkspace() {
        if (!this.config.prod) {
            logger.info(`copying workspace '${this.workspacePackage.getName()}' files to output dir.`);
            this.workspacePackage.copyFiles();
        }
        this.copyResourcesToSource(this.resources.getFiles(), this.workspacePackage);
        logger.info(`start transform workspace '${this.workspacePackage.getName()}'.`);
        // let transformer = this.getWorkspaceTransformer();

        let transformedFiles: string[] = [];
        this.source.getFiles().forEach(path => {
            if (transformedFiles.includes(path)) {
                return;
            }
            logger.info(`transform '${path}'.`);
            this.transformerHandler.handle(path, this.workspacePackage.resolveOut(path), {
                jsTransformer: this.jsTransformer,
                nodeModulePath: this.nodeModulePath,
                packageInfo: this.workspacePackage,
                plugins: this.config.plugins,
                outDir: this.config.outDir,
                provider: this.provider
            }, transformedFiles);
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



