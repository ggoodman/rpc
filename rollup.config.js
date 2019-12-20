'use strict';

const { builtinModules } = require('module');
const { resolve } = require('path');

const RollupPluginTypescript = require('@wessberg/rollup-plugin-ts');
const RollupPluginNodeResolve = require('rollup-plugin-node-resolve');
const RollupPluginCommonJs = require('rollup-plugin-commonjs');
const { terser } = require('rollup-plugin-terser');
const Typescript = require('typescript');

const pkg = require('./package.json');

module.exports = [
  {
    input: resolve(__dirname, 'src/index.ts'),
    output: [
      {
        name: 'Velcro',
        extend: true,
        file: resolve(__dirname, pkg.unpkg),
        format: 'umd',
      },
    ],
    plugins: [
      RollupPluginNodeResolve({ extensions: ['.mjs', '.js'] }),
      RollupPluginCommonJs(),
      RollupPluginTypescript({
        tsconfig: {
          target: Typescript.ScriptTarget.ES2015,
        },
      }),
      terser({
        mangle: {
          reserved: ['Velcro'],
        },
      }),
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
        file: resolve(__dirname, pkg.browser),
        format: 'cjs',
        sourcemap: true,
      },
      {
        file: resolve(__dirname, pkg.module),
        format: 'esm',
        sourcemap: true,
      },
    ],
    external: [...Object.keys(pkg.dependencies), ...builtinModules],
    plugins: [RollupPluginTypescript({})],
  },
];
