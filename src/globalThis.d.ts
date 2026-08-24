/* eslint-disable no-var, vars-on-top */

declare namespace globalThis {
  interface SixKLabsDev {
    utils: typeof utils
  }

  var SixKLabs: SixKLabsDev | undefined
}
