import { describe, expect, it, vi } from 'vitest'
import { TypedEventTarget } from './event'

// eslint-disable-next-line ts/consistent-type-definitions
type TestEventMap = {
  ping: CustomEvent<{ value: number }>
}

class TestEmitter extends TypedEventTarget<TestEventMap> {}

describe('test TypedEventTarget', () => {
  it('dispatchCustomEvent delivers typed detail to listeners', () => {
    const emitter = new TestEmitter()
    const handler = vi.fn()
    emitter.addEventListener('ping', handler)

    const returned = emitter.dispatchCustomEvent('ping', {
      detail: { value: 7 },
    })

    expect(returned).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].detail).toEqual({ value: 7 })
  })

  it('supports handleEvent object listeners', () => {
    const emitter = new TestEmitter()
    const handleEvent = vi.fn()
    emitter.addEventListener('ping', { handleEvent })

    emitter.dispatchCustomEvent('ping', { detail: { value: 1 } })
    expect(handleEvent).toHaveBeenCalledTimes(1)
  })

  it('removed listeners no longer fire and result reflects that', () => {
    const emitter = new TestEmitter()
    const handler = vi.fn()
    emitter.addEventListener('ping', handler)
    emitter.removeEventListener('ping', handler)

    const returned = emitter.dispatchCustomEvent('ping', {
      detail: { value: 0 },
    })

    expect(returned).toBe(true) // dispatched, just nobody listened
    expect(handler).not.toHaveBeenCalled()
  })
})
