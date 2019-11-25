'use strict';

const { resolve } = require('path');

const RollupPluginNodeResolve = require('rollup-plugin-node-resolve');
const RollupPluginCommonJs = require('rollup-plugin-commonjs');
const RollupPluginTypescript = require('@wessberg/rollup-plugin-ts');

const pkg = require('./package.json');

module.exports = [
  {
    input: resolve(__dirname, 'src/index.ts'),
    output: [
      {
        name: 'Velcro',
        extend: true,
        file: resolve(__dirname, pkg.browser),
        format: 'umd',
      },
    ],
    plugins: [
      RollupPluginNodeResolve({ extensions: ['.mjs', '.js'] }),
      RollupPluginCommonJs(),
      RollupPluginTypescript({}),
    ],
  },
  {
    input: resolve(__dirname, 'src/index.ts'),
    output: [
      {
        file: resolve(__dirname, pkg.main),
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: resolve(__dirname, pkg.module),
        format: 'esm',
        sourcemap: true,
      },
    ],
    external: [...Object.keys(pkg.dependencies)],
    plugins: [RollupPluginTypescript({})],
  },
];
