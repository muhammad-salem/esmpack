import { readFileSync } from 'fs';

export function readFile(path: string): string {
    return readFileSync(path, 'utf8');
}

export function readJSON<T>(path: string): T {
    return JSON.parse(readFile(path)) as T;
}
