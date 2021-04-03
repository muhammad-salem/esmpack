#!/usr/bin/env node

import {
    existsSync, lstatSync, readdirSync,
    readFileSync, rmdirSync, unlinkSync
} from 'fs';
import { join, resolve } from 'path';
import { exit } from 'process';
import {
    ESMConfig, ESMTransformer, findPluginByName, JSConfig,
    setLogLevel, LogLevel, PackageJson, getPackageIndex, logger, TypeOf, Plugin, PluginHandler
} from '../dist/index.js';

const APP_VERSION = '0.1.93';

const args = process.argv;
const inputs = args.slice(2);
const help = inputs.includes('-h') || inputs.includes('--help');
if (help) {
    let helpStr =
        `
Version ${APP_VERSION}
Usage: esmpack [config path] [options]

if no config file in the commend will try to search for file names
'esmpack.config.js', 'esmpack.config.mjs' and 'esmpack.config.json'.

Examples:
    esmpack
    esmpack esmpack.config.js.js
    esmpack esmpack.config.json -w -d
    esmpack -v
    esmpack --help

Options:
            --prod      build for production, minify modules, css, etc...
    -d      --debug     output debug messages on internal operations
    -s      --silent    don't print any thing
    -w      --watch     watch files for change
    -h      --help      print help message
    -v      --version   output the version number`;
    console.log(helpStr);
    exit();
}
const version = inputs.includes('-v') || inputs.includes('--version');
if (version) {
    console.log(APP_VERSION);
    exit();
}
const watch = inputs.includes('-w') || inputs.includes('--watch');
const debug = inputs.includes('-d') || inputs.includes('--debug');
const silent = inputs.includes('-s') || inputs.includes('--silent');
const prod = inputs.includes('--prod');
let configPath = inputs.find(arg => /(\.m?js$)|(.json)/g.test(arg));

function deleteFolderRecursive(dirPath: string) {
    if (existsSync(dirPath)) {
        readdirSync(dirPath).forEach((file, index) => {
            const curPath = join(dirPath, file);
            if (lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                unlinkSync(curPath);
            }
        });
        rmdirSync(dirPath);
    }
    logger.debug(dirPath, ' -- removed');
}

function lunchApp(config: ESMConfig) {
    deleteFolderRecursive(config.outDir);
    const transform = new ESMTransformer(config, process.cwd());
    transform.transformWorkspace();
    transform.transformDependencies();
    if (watch) {
        transform.watch();
    }
}

function lunchAppForPackageConfig(config: ESMConfig) {
    deleteFolderRecursive(config.outDir);
    const transform = new ESMTransformer(config, process.cwd());
    transform.provider.set(transform.workspacePackage.getName(), transform.workspacePackage);
    transform.transformDependencies();
    // transform.transformWorkspace();
    if (watch) {
        transform.watchForPackage();
    }
}

function toESMConfig(jsConfig: JSConfig): ESMConfig {
    jsConfig.moduleResolution ??= 'relative';
    if (jsConfig.moduleResolution === 'static' && !jsConfig.baseUrl) {
        throw new Error("must provide baseUrl with 'static' moduleResolution");
    }

    jsConfig.outDir ??= 'esmpack/dist';
    jsConfig.extension ??= '.js';
    jsConfig.workspaceResolution ??= 'all';

    if (jsConfig.src) {
        jsConfig.src.files ||= [];
        jsConfig.src.include ||= [];
        jsConfig.src.exclude ||= [];
    } else {
        // throw new Error("no src input found in" + configModulePath);
        jsConfig.src = { include: ["**/*"], files: [], exclude: ['node_modules/**/*'] }
    }

    if (jsConfig.resources) {
        jsConfig.resources.files ||= [];
        jsConfig.resources.include ||= [];
        jsConfig.resources.exclude ||= [];
    } else {
        // throw new Error("no resources input found in" + configModulePath);
        jsConfig.resources = { include: ["**/*"], files: [], exclude: ['node_modules/**/*'] }
    }

    jsConfig.plugins ??= [];

    let pluginHandler = jsConfig.plugins
        .map(pluginRef => {
            if (typeof pluginRef === 'string') {
                return findPluginByName(pluginRef);
            } else if (typeof pluginRef === 'object') {
                // return findPluginByName(pluginRef.name, pluginRef.action);
                if (pluginRef.moduleType) {
                    return { regexp: pluginRef.test, handler: new Plugin(pluginRef.moduleType) } as PluginHandler;
                } else {
                    return { regexp: pluginRef.test, handler: { transform: pluginRef.handler } } as PluginHandler;
                }
            }
        })
        .filter(plugin => plugin);

    let esmConfig: ESMConfig = {
        outDir: jsConfig.outDir,
        src: jsConfig.src,
        resources: jsConfig.resources,
        pathMap: jsConfig.pathMap || {},
        extension: jsConfig.extension,
        moduleResolution: jsConfig.moduleResolution,
        baseUrl: jsConfig.baseUrl,
        workspaceResolution: jsConfig.workspaceResolution,
        plugins: pluginHandler,
        prod
    };
    return esmConfig;
}

function initLogLevel() {
    if (debug) {
        setLogLevel(LogLevel.debug);
    } else if (silent) {
        setLogLevel(LogLevel.off);
    } else {
        setLogLevel(LogLevel.info);
    }
}

function isFound(path: string) {
    return existsSync(path) && path;
}

if (!configPath) {
    // search for js module as config
    configPath = isFound(resolve(process.cwd(), 'esmpack.config.js'))
        || isFound(resolve(process.cwd(), 'esmpack.config.mjs'))
        || isFound(resolve(process.cwd(), 'esmpack.config.json'));
    // || isFound(resolve(process.cwd(), 'package.json'));
    if (isFound(configPath)) {
        if (debug || !silent) {
            console.log(`load config from: ${configPath}`);
        }
    } else {
        console.error(`no config file found`);
        exit(404);
    }
} else {
    configPath = resolve(process.cwd(), configPath);
}

if (configPath.endsWith('.json')) {
    initLogLevel();
    // json config
    const jsonObject = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (configPath.endsWith('esmpack.json')) {
        // setup/load config from json file;
        let jsConfig: JSConfig = jsonObject;
        let esmConfig = toESMConfig(jsConfig);
        lunchApp(esmConfig);
    } else if (configPath.endsWith('package.json')) {
        // setup/load config from as dependencies package;
        let packageJson: PackageJson = jsonObject;
        let packagePath = resolve(configPath, '..');
        let jsConfig: JSConfig = {
            outDir: resolve(packagePath, 'esmpack/dist'),
            src: {
                include: [packagePath + '/**/*.js'],
                exclude: [
                    packagePath + '/node_modules/**/*',
                    packagePath + '/esmpack/dist/**/*'
                ],
                files: [
                    resolve(packagePath, getPackageIndex(packageJson))
                ]
            },
            workspaceResolution: 'follow'
        };
        let esmConfig = toESMConfig(jsConfig);
        lunchAppForPackageConfig(esmConfig);
    }
} else if (/\.m?js$/g.test(configPath)) {
    // js config
    import(configPath).then(module => {
        initLogLevel();
        let jsConfig: JSConfig = module.default;
        let esmConfig = toESMConfig(jsConfig);
        lunchApp(esmConfig);
    });
} else {
    // error
    console.error('config file is nt supported.');
    exit(404);
}

