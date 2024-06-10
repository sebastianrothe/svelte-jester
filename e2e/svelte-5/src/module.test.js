import { test } from '@jest/globals'

import * as Subject from './module.svelte.js'

test('get current count', () => {
  const subject = Subject.createCounter()
  const result = subject.count

  expect(result).toBe(0)
})

test('increment', () => {
  const subject = Subject.createCounter()

  subject.increment()
  const result = subject.count

  expect(result).toBe(1)
})
