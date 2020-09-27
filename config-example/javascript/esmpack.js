export const config = {
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
        'css',
        'html',
        'image',
        'json',
        'txt',
        {
            regexp: /\.pdf/g,
            handler: {}
        }
    ]
};
export default config;
