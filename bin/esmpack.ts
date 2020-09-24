#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { exit } from 'process';
import {
    CSSPlugin, ESMConfig, HTMLPlugin, ImagePlugin, JSONPlugin,
    TextPlugin, ESMTransformer, findPluginByName, JSConfig,
    setLogLevel, LogLevel, PackageJson, getPackageIndex
} from '../dist/index.js';


const args = process.argv;
const inputs = args.slice(2);
const watch = inputs.includes('-w') || inputs.includes('--watch');
const debug = inputs.includes('-d') || inputs.includes('--debug');
const silent = inputs.includes('-s') || inputs.includes('--silent');
const prod = inputs.includes('--prod');
let configPath = inputs.find(arg => /(\.m?js$)|(.json)/g.test(arg));

function lunchApp(config: ESMConfig) {
    const transform = new ESMTransformer(config, process.cwd());
    transform.transformDependencies();
    transform.transformWorkspace();

    if (watch) {
        transform.watch();
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

    jsConfig.plugins ??= [
        CSSPlugin,
        HTMLPlugin,
        ImagePlugin,
        JSONPlugin,
        TextPlugin
    ];

    let esmConfig: ESMConfig = {
        outDir: jsConfig.outDir,
        src: jsConfig.src,
        resources: jsConfig.resources,
        pathMap: jsConfig.pathMap || {},
        extension: jsConfig.extension,
        moduleResolution: jsConfig.moduleResolution,
        baseUrl: jsConfig.baseUrl,
        workspaceResolution: jsConfig.workspaceResolution,
        plugins: [],
        prod
    };

    esmConfig.plugins = jsConfig.plugins
        .map(pluginRef => {
            if (typeof pluginRef === 'function') {
                let plugType = pluginRef as typeof HTMLPlugin;
                return { regexp: pluginRef.getRegExp(), handler: new plugType() }
            } else if (typeof pluginRef === 'object') {
                // return findPluginByName(pluginRef.name, pluginRef.action);
                return pluginRef;
            } else if (typeof pluginRef === 'string') {
                return findPluginByName(pluginRef);
            }
        })
        .filter(plugin => plugin);
    return esmConfig;
}

function initLogLevel() {
    console.log('init logging');

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
    configPath = isFound(resolve(process.cwd(), 'esmpack.js'))
        || isFound(resolve(process.cwd(), 'esmpack.mjs'))
        || isFound(resolve(process.cwd(), 'esmpack.json'))
        || isFound(resolve(process.cwd(), 'package.json'));
    if (!isFound(configPath)) {
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
        lunchApp(esmConfig);
    }
} else if (/(\.m?js$)|(.json)/g.test(configPath)) {
    // js config
    import(configPath).then(module => {
        initLogLevel();
        let jsConfig: JSConfig = module.default;
        let esmConfig = toESMConfig(jsConfig);
        lunchApp(esmConfig);
    });
} else {
    // error
    exit(404);
}

