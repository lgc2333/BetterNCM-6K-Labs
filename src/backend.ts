import {
  ensureTmpDir,
  escapePowershellInput,
  runPowershellWithOutput,
  TypedEventTarget,
  waitForFunction,
} from './utils'

export const SERVER_PROCESS_NAME = 'bncm-6k-labs-server'
export const SERVER_FILENAME = `${SERVER_PROCESS_NAME}.exe`
export const TOO_SOON_TIME = 10000
export const RETRY_TIME = 3000
export const DETECT_DELAY = 2000

export interface QueryProcessOptions {
  name?: string
  id?: number
}

export interface ProcessInfo {
  processName: string
  id: number
}

export async function queryProcess(opt: QueryProcessOptions): Promise<ProcessInfo[]> {
  const cmdOpts = Object.entries(opt)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `-${k} "${escapePowershellInput(`${v}`)}"`)
    .join(' ')
  if (!cmdOpts) {
    throw new Error('No query options')
  }

  const { output } = await runPowershellWithOutput(
    `Get-Process -ErrorAction SilentlyContinue ${cmdOpts}` +
      ` | Select-Object ProcessName, Id` +
      ` | ConvertTo-Json -Compress`,
  )

  if (!output) {
    // no result will produce empty output
    return []
  }

  const processes: any = JSON.parse(output)
  // single process will not return a single item array
  const processArray: Record<string, any>[] = Array.isArray(processes)
    ? processes
    : [processes]
  return processArray.map((p) =>
    Object.fromEntries(Object.entries(p).map(([k, v]) => [k.toLowerCase(), v])),
  ) as any
}

export async function queryServerProcessId(): Promise<number | undefined> {
  const processes = await queryProcess({ name: SERVER_PROCESS_NAME })
  return processes[0]?.id
}

export async function killServer(): Promise<void> {
  await runPowershellWithOutput(`Stop-Process -Name "${SERVER_PROCESS_NAME}" -Force`)
}

export async function getServerOriginalPath(): Promise<string> {
  const pluginPath = loadedPlugins['6k-labs'].pluginPath.replace('/./', '/')
  return `${pluginPath}/${SERVER_FILENAME}`
}

export async function ensureServerTempPath(): Promise<string> {
  return `${await ensureTmpDir()}/${SERVER_FILENAME}`
}

export async function copyServerToTemp(): Promise<string> {
  const originalPath = await getServerOriginalPath()
  const tempPath = await ensureServerTempPath()
  await runPowershellWithOutput(
    `Copy-Item` +
      ` -Path "${escapePowershellInput(originalPath)}"` +
      ` -Destination "${escapePowershellInput(tempPath)}"`,
  )
  return tempPath
}

export async function startServer(): Promise<number> {
  const { output } = await runPowershellWithOutput(
    `(Start-Process` +
      ` -PassThru` +
      ` -WindowStyle Hidden` +
      ` -FilePath "${escapePowershellInput(await copyServerToTemp())}"` +
      `).ID`,
  )
  return parseInt(output, 10)
}

export enum StopType {
  MANUALLY,
  ACCIDENTALLY,
  ACCIDENTALLY_TOO_SOON,
  START_FAILED,
}

export type ProcessWatcherEventMap = {
  stopped: CustomEvent<undefined>
}

export class ProcessWatcher extends TypedEventTarget<ProcessWatcherEventMap> {
  protected _closed = false
  protected _taskPromise: Promise<void>

  public get closed() {
    return this._closed
  }

  constructor(public readonly pid: number) {
    super()
    this._taskPromise = this.task()
  }

  protected task() {
    const dispatchEv = () => {
      if (this._closed) return
      this.dispatchCustomEvent('stopped', {})
      this._closed = true
    }
    return waitForFunction(
      async () => {
        const processes = await queryProcess({ id: this.pid })
        return this._closed || processes.length === 0
      },
      {
        delay: DETECT_DELAY,
        times: 0,
        ignoreException: false,
      },
    ).then(dispatchEv, dispatchEv)
  }

  public close() {
    this._closed = true
  }
}

export type BackendSvrManagerEventMap = {
  starting: CustomEvent<undefined>
  started: CustomEvent<undefined>
  stopped: CustomEvent<StopType>
  beforeKill: CustomEvent<undefined>
}

export class BackendSvrManager extends TypedEventTarget<BackendSvrManagerEventMap> {
  protected _processWatcher: ProcessWatcher | undefined
  protected _lastStartTime = 0
  protected _stopped = true
  protected _stopType: StopType = StopType.MANUALLY

  protected processStopCallback = () => {
    if (this._stopped) return

    if (Date.now() - this._lastStartTime < TOO_SOON_TIME) {
      this._stopType = StopType.ACCIDENTALLY_TOO_SOON
      this._stopped = true
      console.log('Server stopped too soon, will not restart')
      this.dispatchCustomEvent('stopped', { detail: this._stopType })
      return
    }

    this._stopType = StopType.ACCIDENTALLY
    console.log(`Server accidentally stopped, will restart after ${RETRY_TIME}ms`)
    this.dispatchCustomEvent('stopped', { detail: this._stopType })
    setTimeout(() => {
      this.restart()
    }, RETRY_TIME)
  }

  public get processRunning(): boolean {
    return this._processWatcher !== undefined && !this._processWatcher.closed
  }

  public get stopped(): boolean {
    return this._stopped
  }

  public get stopType(): StopType {
    return this._stopType
  }

  protected async _restart() {
    // const queriedAliveProcessId = await queryServerProcessId()
    // if (queriedAliveProcessId === undefined) {
    const pid = await startServer()
    this._processWatcher = new ProcessWatcher(pid)
    // } else {
    //   this._processWatcher = new ProcessWatcher(queriedAliveProcessId)
    // }
    this._lastStartTime = Date.now()
    this._processWatcher.addEventListener(
      'stopped',
      this.processStopCallback.bind(this),
    )
  }

  public async restart() {
    this.dispatchCustomEvent('starting', {})
    try {
      await this.kill()
      this._stopped = false
      await this._restart()
    } catch (e) {
      this._stopped = true
      this._stopType = StopType.START_FAILED
      console.error('Server start failed')
      console.error(e)
      this.dispatchCustomEvent('stopped', { detail: this._stopType })
    }
    this.dispatchCustomEvent('started', {})
  }

  public async kill(stopType: StopType = StopType.MANUALLY) {
    const originalStopped = this._stopped
    this._stopped = true
    this._stopType = stopType

    if (!originalStopped) {
      this.dispatchCustomEvent('beforeKill', {})
    }

    if (this._processWatcher) {
      this._processWatcher.close()
      this._processWatcher = undefined
      console.log('ProcessWatcher closed')
    }

    await killServer()
    console.log('Server killed')

    if (!originalStopped) {
      this.dispatchCustomEvent('stopped', { detail: this._stopType })
    }
  }
}

export const backendSvrManager = new BackendSvrManager()
