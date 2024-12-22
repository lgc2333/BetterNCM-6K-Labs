export async function getTmpDirPath(): Promise<string> {
  return `${await betterncm.app.getDataPath()}/6K-Labs-Temp`
}

export async function removeTmpDir(): Promise<void> {
  const path = await getTmpDirPath()
  if (await betterncm.fs.exists(path)) {
    await betterncm.fs.remove(path)
  }
}

export async function ensureTmpDir(): Promise<string> {
  const path = await getTmpDirPath()
  if (!(await betterncm.fs.exists(path))) {
    await betterncm.fs.mkdir(path)
  }
  return path
}

export type ExcludeFalsy<T> = T extends false | null | undefined | '' ? never : T

export interface WaitForFunctionOptions {
  /** default 200 */
  delay?: number
  /** 0 disable, default 15 */
  times?: number
  /** default true */
  ignoreException?: boolean
}

export async function waitForFunction<R>(
  func: () => R,
  options?: WaitForFunctionOptions,
): Promise<ExcludeFalsy<Awaited<R>>> {
  const { delay = 200, times = 15, ignoreException = true } = options ?? {}
  // eslint-disable-next-line no-unmodified-loop-condition
  for (let i = 0; times === 0 || i < times; i += 1) {
    if (i !== 0) await betterncm.utils.delay(delay)
    let res: R
    try {
      res = await func()
    } catch (e) {
      if (ignoreException) {
        console.error(e)
        continue
      }
      throw e
    }
    if (res) {
      return res as any
    }
  }
  throw new Error('waitForFunction timeout')
}

export function randomChars(length: number): string {
  return Array.from({ length }, () =>
    String.fromCharCode(Math.floor(Math.random() * 26) + 97),
  ).join('')
}
