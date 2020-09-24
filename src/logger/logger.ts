export enum LogLevel {
    off, info, debug
};

export interface LoggerInterface {
    info(...data: any[]): void;
    debug(...data: any[]): void;
    error(...data: any[]): void;
    exception(message?: string, ...optionalParams: any[]): void;
}

let level: LogLevel = LogLevel.info;
export function setLogLevel(logLevel: LogLevel) {
    level = logLevel;
}

export function isAllow(logLevel: LogLevel) {
    return level >= logLevel;
}

export class Logger implements LoggerInterface {
    constructor() { }
    info(...data: any[]): void {
        if (isAllow(LogLevel.info)) {
            console.log(...data);
        }
    }
    debug(...data: any[]): void {
        if (isAllow(LogLevel.debug)) {
            console.log(...data);
        }
    }
    error(...data: any[]): void {
        console.log(...data);
    }

    exception(message?: string, ...optionalParams: any[]): void {
        console.exception(message, optionalParams.length === 0 ? undefined : optionalParams);
    }

}

export const logger = new Logger();
