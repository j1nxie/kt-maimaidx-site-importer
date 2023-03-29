import terser from '@rollup/plugin-terser';

export default {
  input: 'kt-maimaidx-site-importer.user.js',
  output: {
    file: 'kt-maimaidx-site-importer.min.js',
    format: 'iife'
  },
  plugins: [terser()]
};
