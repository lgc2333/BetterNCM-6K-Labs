import { TypedEventTarget } from './utils'

export function parseTasklistCSV(csv: string): string[][] {
  return csv.split('\n').map((line) => {
    const x = line.split('","')
    x[0] = x[0].replace(/^"/, '')
    x[x.length - 1] = x[x.length - 1].replace(/"$/, '')
    return x
  })
}

export async function getTmpDir(): Promise<string> {
  const path = `${await betterncm.app.getDataPath()}/6K-Labs-Temp`
  if (!(await betterncm.fs.exists(path))) {
    await betterncm.fs.mkdir(path)
  }
  return path
}

export async function genTmpFilePath(): Promise<string> {
  return `${await getTmpDir()}/${Date.now()}.tmp`
}

export async function waitOutFile(
  filePath: string,
  opts: {
    delay?: number
    times?: number
    shouldDelete?: boolean
  } = {},
): Promise<string> {
  const { delay = 200, times = 15, shouldDelete = true } = opts
  for (let i = 0; ; i += 1) {
    if (i >= times) throw new Error('waitOutFile timeout')
    await betterncm.utils.delay(delay)
    if (await betterncm.fs.exists(filePath)) break
  }

  const read = async () =>
    (
      await betterncm.fs.readFileText(filePath).catch((e) => {
        console.error(e)
        return ''
      })
    ).trim()

  let res: string = ''
  // 有时读文件会 500，怀疑在文件被占用时读取，所以尝试多次
  for (let i = 0; !res && i < times; i += 1) {
    res = await read()
    if (res) break
    await betterncm.utils.delay(delay)
  }

  if (shouldDelete) {
    betterncm.fs.remove(filePath).catch(console.error)
  }
  return res
}

export function escapePathArg(arg: string): string {
  return arg.replaceAll('\\', '/') // .replaceAll(`'`, `\\\\'`)
}

export const SERVER_FILENAME = 'bncm-6k-labs-server.exe'
export const DEBOUNCE_TIME = 10000
export const RETRY_TIME = 3000
export const DETECT_DELAY = 2000
export const SERVER_PID_FILE = 'bncm-6k-labs-server.pid'

export async function getPIDFilePath(): Promise<string> {
  return `${await getTmpDir()}/${SERVER_PID_FILE}`
}

export type BackendSvrProcEventMap = {
  stopped: CustomEvent<undefined>
}

export class BackendSvrProc extends TypedEventTarget<BackendSvrProcEventMap> {
  protected task: Promise<void> | null

  public get running(): boolean {
    return !!this.task
  }

  protected promiseEndCallback = () => {
    if (!this.task) return
    this.task = null
    this.dispatchCustomEvent('stopped', {})
  }

  constructor(public readonly pid: string) {
    super()
    this.task = this.waitForStop().then(
      () => this.promiseEndCallback(),
      (e) => {
        console.error(e)
        return this.promiseEndCallback()
      },
    )
  }

  public static async getStoredPID(): Promise<string | undefined> {
    const pidFilePath = await getPIDFilePath()
    if (await betterncm.fs.exists(pidFilePath)) {
      return (await betterncm.fs.readFileText(pidFilePath)).trim() ?? undefined
    }
    return undefined
  }

  public static async killAllByName() {
    await betterncm.app.exec(`taskkill /F /IM ${SERVER_FILENAME}`)
    console.log('Server killed (by name)')
  }

  public static async restoreProc(): Promise<BackendSvrProc | undefined> {
    const pid = await this.getStoredPID()
    if (pid) {
      const p = new BackendSvrProc(pid)
      if (await p.checkRunning()) return p
    }
    return undefined
  }

  public static async newProc(): Promise<BackendSvrProc> {
    const restored = await this.restoreProc()
    if (restored) {
      console.log('Server already running, skip start')
      return restored
    }

    // kill other servers
    await this.killAllByName()

    const pidFilePath = await getPIDFilePath()
    const pluginPath = loadedPlugins['6k-labs'].pluginPath.replace('/./', '/')
    const serverPath = `${pluginPath}/${SERVER_FILENAME}`
    await betterncm.app.exec(
      `powershell -Command "` +
        `(Start-Process -PassThru -WindowStyle Hidden` +
        ` -FilePath '${escapePathArg(serverPath)}').ID` +
        ` | Out-File -Encoding utf8 -FilePath '${escapePathArg(pidFilePath)}'` +
        `"`,
    )
    const pid = await waitOutFile(pidFilePath, { shouldDelete: false })
    console.log('Server started')
    return new BackendSvrProc(pid)
  }

  public async checkRunning(): Promise<boolean> {
    const tmpPath = await genTmpFilePath()
    await betterncm.app.exec(
      `powershell -Command ` +
        `"` +
        `((((Get-Process -Id ${this.pid}) 2> $null) -and $True) -or $False)` +
        ` | Out-File -Encoding utf8 -FilePath '${escapePathArg(tmpPath)}'` +
        `"`,
    )
    const res = (await waitOutFile(tmpPath)) === 'True'

    if (!res) {
      const pidFilePath = await getPIDFilePath()
      if (await betterncm.fs.exists(pidFilePath)) {
        await betterncm.fs.remove(pidFilePath)
      }
    }

    return res
  }

  public async waitForStop() {
    for (;;) {
      if (!(await this.checkRunning())) break
      await betterncm.utils.delay(DETECT_DELAY)
    }
  }

  public async kill() {
    // if (!this.task) return
    this.task = null
    await betterncm.app.exec(`taskkill /F /PID ${this.pid}`)
    await this.waitForStop()
    this.dispatchCustomEvent('stopped', {})
    console.log('Server killed')
  }
}

export enum StopType {
  MANUALLY,
  ACCIDENTALLY,
  ACCIDENTALLY_TOO_SOON,
  START_FAILED,
}

export type BackendSvrManagerEventMap = {
  started: CustomEvent<undefined>
  stopped: CustomEvent<StopType>
  beforeKill: CustomEvent<undefined>
}

export class BackendSvrManager extends TypedEventTarget<BackendSvrManagerEventMap> {
  public proc?: BackendSvrProc
  protected lastStartTime = 0

  protected _starting = false
  protected _stopped = true
  protected _stopType: StopType = StopType.MANUALLY

  protected stoppedCallback = () => {
    if (this._stopped) {
      this._stopType = StopType.MANUALLY
      console.log('Server stopped manually')
    } else {
      const now = Date.now()
      if (now - this.lastStartTime < DEBOUNCE_TIME) {
        this._stopped = true
        this._stopType = StopType.ACCIDENTALLY_TOO_SOON
        console.log('Server stopped too soon, will not restart')
      } else {
        this._stopType = StopType.ACCIDENTALLY
      }
    }
    this.dispatchCustomEvent('stopped', { detail: this._stopType })

    if (this._stopType === StopType.ACCIDENTALLY) {
      console.log(`Server accidentally stopped, will retry in ${RETRY_TIME} ms`)
      setTimeout(() => {
        if (!this._stopped) this.restart()
      }, RETRY_TIME)
    }
  }

  public get running(): boolean {
    return !!this.proc?.running
  }

  public get stopped(): boolean {
    return this._stopped
  }

  public get stopType(): StopType {
    return this._stopType
  }

  public async restart() {
    if (this._starting) return
    this._starting = true
    await this.kill()
    this._stopped = false
    this._stopType = StopType.MANUALLY
    this.lastStartTime = Date.now()
    try {
      this.proc = await BackendSvrProc.newProc()
    } catch (e) {
      this._starting = false
      console.error(e)
      this.kill()
      this._stopType = StopType.START_FAILED
      this.dispatchCustomEvent('stopped', { detail: this._stopType })
      return
    }
    this.proc.addEventListener('stopped', this.stoppedCallback)
    this._starting = false
    this.dispatchCustomEvent('started', {})
  }

  public async kill() {
    this._stopped = true
    this.dispatchCustomEvent('beforeKill', {})
    if (this.proc) await this.proc.kill()
    this.proc = undefined
  }
}

export const backendSvrManager = new BackendSvrManager()
