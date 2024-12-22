/* eslint-disable no-var */

declare module globalThis {
  interface SixKLabsDev {
    utils: typeof utils
  }

  var SixKLabs: SixKLabsDev | undefined
}
