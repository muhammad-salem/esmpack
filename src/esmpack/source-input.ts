// import { glob } from 'glob';
import { SourceInput } from './config.js';
import pkg from 'glob';
const { glob } = pkg;

export class GlopSourceInput {
    private found: string[];
    constructor(public srcInput: SourceInput) { }

    private getPattern(path: string[]) {
        return path.length > 1 ?
            `{${path.join(',')}}` : path.length === 1 ? path[0] : '';
    }

    scanFiles() {
        let include: string[], files: string[];
        if (this.srcInput.include.length > 0) {
            include = glob.sync(this.getPattern(this.srcInput.include),
                { ignore: this.srcInput.exclude }
            );
        } else {
            include = [];
        }

        if (this.srcInput.files.length > 0) {
            files = glob.sync(this.getPattern(this.srcInput.files));
        } else {
            files = [];
        }
        let result = [...files, ...include];
        if (result.length === 0) {
            result = glob.sync('**/*');
        }
        this.found = [...new Set<string>(result).values()];
    }

    getFiles() {
        if (!this.found) {
            this.scanFiles();
        }
        return this.found;
    }
}
