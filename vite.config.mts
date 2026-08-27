import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'

  return {
    esbuild: {
      jsxFactory: 'h',
      jsxFragment: 'f',
    },
    build: {
      target: 'chrome91',
      outDir: 'dist',
      minify: !isDev,
      // dist/ also holds native DLLs and metadata copied by `build:native`
      emptyOutDir: false,
      lib: {
        entry: resolve(import.meta.dirname, 'src/main.ts'),
        formats: ['iife'],
        name: 'BetterNCM6KLabs',
        fileName: () => 'main.js',
      },
      rollupOptions: {
        // React is injected by NCM as a page global (`window.React`); never bundle it
        external: [/^react($|\/)/],
        output: {
          globals: {
            react: 'React',
            'react/jsx-runtime': 'React',
          },
        },
      },
    },
    plugins: [cssInjectedByJsPlugin()],
  }
})
