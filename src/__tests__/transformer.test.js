import { readFileSync } from 'fs'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { jest } from '@jest/globals'

import transformer from '../../dist/transformer.mjs'

// Node API __dirname is missing in ESM
export const __dirname = dirname(fileURLToPath(import.meta.url))

const runTransformerAsync = async (filename, options) => {
  const path = `${__dirname}/fixtures/${filename}.svelte`
  const source = readFileSync(path).toString()
  const result = await transformer.processAsync(source, path, { transformerConfig: options })
  expect(result.code).toBeDefined()
  expect(result.code).toContain('SvelteComponent')
  expect(result.map).toBeDefined()
  return result.code
}

describe('ESM transformer', () => {
  it('should transform with config in ESM format', async () => {
    const svelteKitConfigPath = `${__dirname}/fixtures/sveltekit.config.js`
    const results = await runTransformerAsync('BasicComp', {
      preprocess: svelteKitConfigPath
    })
    // this is a little brittle, but it demonstrates that the replacements in
    // "sveltekit.config.js" are working
    expect(results).toContain('text("Bye ");')
  })

  it('should transform basic component', async () => {
    await runTransformerAsync('BasicComp')
  })

  it('should transform when using sass preprocessor', async () => {
    await runTransformerAsync('SassComp', { preprocess: true })
  })

  it('should transform when using full path to preprocess', async () => {
    const preprocessPath = `${__dirname}/../../_svelte.config.cjs`
    await runTransformerAsync('SassComp', { preprocess: preprocessPath })
  })

  it('should search for "svelte.config.cjs" as well as "svelte.config.js"', async () => {
    const results = await runTransformerAsync('BasicComp', {
      preprocess: true,
      rootMode: 'upward'
    })
    // this is a little brittle, but it demonstrates that the replacements in
    // "svelte.config.cjs" are working
    expect(results).toContain('text("Bye ");')
  })

  it('should transform when using typescript preprocessor', async () => {
    await runTransformerAsync('TypescriptComp', { preprocess: true })
  })

  it('should transform basic component and keep styles', async () => {
    const code = await runTransformerAsync('BasicComp')
    expect(code).toContain('add_css(target)')
    expect(code).toContain('.counter.active')
  })

  it('should accept compiler options', async () => {
    const code = await runTransformerAsync('BasicComp', {
      compilerOptions: { css: false }
    })
    expect(code).not.toContain('add_css(target)')
    expect(code).not.toContain('.counter.active')
  })

  it('should output code to console when debug is true', async () => {
    console.log = jest.fn()
    const code = await runTransformerAsync('BasicComp', { debug: true })
    const esInterop =
      'Object.defineProperty(exports, "__esModule", { value: true });'
    expect(console.log).toHaveBeenCalledTimes(1)
    expect(console.log).toHaveBeenCalledWith(code.replace(esInterop, ''))
  })

  it('should pass, if console.logs are disabled (default) during preprocessing and there is a console.log statement in the svelte config', async () => {
    await runTransformerAsync('BasicComp', { preprocess: true, rootMode: 'upward' })
  })

  it('should pass, if console.logs are disabled during preprocessing and there is a console.log statement in the svelte config', async () => {
    await runTransformerAsync('BasicComp', {
      preprocess: true,
      rootMode: 'upward',
      showConsoleLog: false
    })
    await runTransformerAsync('BasicComp', {
      preprocess: true,
      rootMode: 'upward',
      showConsoleLog: 'false'
    })
  })

  it('should pass and transform process.env.NODE_ENV variable', async () => {
    const code = await runTransformerAsync('BasicComp', {
      preprocess: true,
      rootMode: 'upward'
    })

    // JEST sets NODE_ENV to test automatically
    expect(code).toContain('test')
  })
})
