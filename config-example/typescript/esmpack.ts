
import { CSSPlugin, JSConfig, HTMLPlugin, ImagePlugin, JSONPlugin, TextPlugin } from '@aurorats/esmpack';

export const config: JSConfig = {
    moduleResolution: 'relative',
    outDir: 'build/mjs/',
    pathMap: { 'src': 'dist' },
    src: {
        files: [],
        include: ['./dist/**/*.js'],
        exclude: []
    },
    resources: {
        files: [],
        include: ['./src/**/*.*'],
        exclude: ['./src/**/*.{js,ts,tsx}']
    },
    plugins: [
        CSSPlugin,
        JSONPlugin,
        ImagePlugin,
        HTMLPlugin,
        TextPlugin
    ]
};

export default config;
