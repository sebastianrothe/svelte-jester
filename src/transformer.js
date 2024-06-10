import { execSync } from 'child_process'
import { basename, extname } from 'path'
import { pathToFileURL } from 'url'
import * as SvelteCompiler from 'svelte/compiler'

import { getSvelteConfig } from './svelteconfig.js'
import { dynamicImport, IS_COMMON_JS, isSvelte3, isSvelteModule } from './utils.js'

const currentFileExtension = (global.__dirname !== undefined ? extname(__filename) : extname(pathToFileURL(import.meta.url).toString())).replace('.', '')

/**
 * Jest will only call this method when running in ESM mode.
 */
const processAsync = async (source, filename, jestOptions) => {
  const options = jestOptions && jestOptions.transformerConfig ? jestOptions.transformerConfig : {}
  const { preprocess, rootMode, debug } = options

  if (IS_COMMON_JS) {
    throw new Error('Running svelte-jester-transformer async in unsupported CJS mode')
  }

  if (debug) {
    console.debug(`Running svelte-jester-transformer async in mode ${currentFileExtension}.`)
  }

  if (!preprocess) {
    return compiler('esm', options, filename, source)
  }

  const svelteConfigPath = getSvelteConfig(rootMode, filename, preprocess)
  const svelteConfig = await dynamicImport(svelteConfigPath)
  const processed = await SvelteCompiler.preprocess(
    source,
    svelteConfig.default.preprocess || {},
    { filename }
  )

  return compiler('esm', options, filename, processed.code, processed.map)
}

/**
 * Starts a new process, so it has a higher overhead than processAsync.
 * However, Jest calls this method in CJS mode.
 */
const processSync = (source, filename, jestOptions) => {
  const options = jestOptions && jestOptions.transformerConfig ? jestOptions.transformerConfig : {}
  const { preprocess, rootMode, maxBuffer, showConsoleLog, debug, svelteVersion } = options

  if (!isSvelte3(svelteVersion)) {
    throw new Error('Jest is being called in CJS mode. You must use ESM mode in Svelte 4+')
  }

  if (!IS_COMMON_JS) {
    throw new Error('Running svelte-jester-transformer sync in unsupported ESM mode')
  }

  if (debug) {
    console.debug(`Running svelte-jester-transformer sync in mode ${currentFileExtension}.`)
  }

  if (!preprocess) {
    return compiler('cjs', options, filename, source)
  }

  const svelteConfig = getSvelteConfig(rootMode, filename, preprocess)
  const preprocessor = require.resolve('./preprocess.js')

  const preprocessResult = execSync(
        `node --unhandled-rejections=strict --abort-on-uncaught-exception "${preprocessor}"`,
        {
          env: { ...process.env, source, filename, svelteConfig, showConsoleLog },
          maxBuffer: maxBuffer || 10 * 1024 * 1024
        }
  ).toString()

  const parsedPreprocessResult = JSON.parse(preprocessResult)
  return compiler('cjs', options, filename, parsedPreprocessResult.code, parsedPreprocessResult.map)
}

const compiler = (format, options = {}, filename, processedCode, processedMap) => {
  const opts = {
    filename: basename(filename),
    css: isSvelte3(options.svelteVersion) ? true : 'injected',
    accessors: true,
    dev: true,
    sourcemap: processedMap,
    ...options.compilerOptions
  }

  if (isSvelte3(options.svelteVersion)) {
    opts.format = format
  }

  const compile = isSvelteModule(filename) ? compileModule : compileComponent

  let result
  try {
    result = compile(processedCode, opts)
  } catch (error) {
    let msg = error.message
    if (error.frame) {
      msg += '\n' + error.frame
    }
    console.error(msg)
    throw error
  }

  if (options.debug) {
    console.log(result.js.code)
  }

  const esInterop = format === 'cjs' ? 'Object.defineProperty(exports, "__esModule", { value: true });' : ''

  return {
    code: result.js.code + esInterop,
    map: JSON.stringify(result.js.map)
  }
}

const compileComponent = (processedCode, opts) => {
  return SvelteCompiler.compile(processedCode, opts)
}

const compileModule = (processedCode, opts) => {
  return SvelteCompiler.compileModule(processedCode, {
    filename: opts.filename,
    dev: opts.dev,
    generate: opts.ssr ? 'server' : 'client'
  })
}

export default {
  process: processSync,
  processAsync
}
