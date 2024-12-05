import { TypedEventTarget } from './utils'

export async function parseTasklistCSV(csv: string): Promise<string[][]> {
  return csv.split('\n').map((line) => {
    const x = line.split('","')
    x[0] = x[0].replace(/^"/, '')
    x[x.length - 1] = x[x.length - 1].replace(/"$/, '')
    return x
  })
}

export async function queryPID(imageName: string): Promise<string[]> {
  const tmpPath = `${await betterncm.app.getDataPath()}/${Date.now()}.tmp`
  await betterncm.app.exec(
    `tasklist /FI "IMAGENAME eq ${imageName}" /NH /FO CSV > "${tmpPath}"`,
  )
  const res = await (await betterncm.fs.readFile(tmpPath)).text()
  const ret = (await parseTasklistCSV(res)).map((x) => x[1])
  await betterncm.fs.remove(tmpPath)
  return ret
}

export const SERVER_FILENAME = 'bncm-6k-labs-server.exe'
export const DEBOUNCE_TIME = 3000
export const RETRY_TIME = 3000

export type BackendSvrManagerEventMap = {
  running: CustomEvent<undefined>
  stopped: CustomEvent<undefined>
}

export class BackendSvrManager extends TypedEventTarget<BackendSvrManagerEventMap> {
  private task: Promise<void> | null = null

  private _stopped = true
  private _stopTooSoon = false

  public get running(): boolean {
    return !!this.task
  }

  public get stopped(): boolean {
    return this._stopped
  }

  public get stopTooSoon(): boolean {
    return this._stopTooSoon
  }

  protected async createProcess(): Promise<void> {
    const pluginPath = loadedPlugins['6k-labs'].pluginPath.replace('/./', '/')
    const serverPath = `${pluginPath}/${SERVER_FILENAME}`
    await betterncm.app.exec(`"${serverPath}"`)
    for (;;) {
      await betterncm.utils.delay(1000)
      if (!(await this.getPID()).length) break
    }
  }

  public async start() {
    if (this.task) {
      await this.kill()
    }
    this._stopped = false

    const startTime = new Date().getTime()
    const stopCallback = () => {
      this.task = null
      this.dispatchEvent(new CustomEvent('stopped'))

      if (this._stopped) return

      if (new Date().getTime() - startTime <= DEBOUNCE_TIME) {
        this._stopTooSoon = true
        // eslint-disable-next-line no-console
        console.log('Server stopped too soon, stop retry')
        return
      }

      // eslint-disable-next-line no-console
      console.log(`Server stopped, relaunching in ${RETRY_TIME}ms`)
      setTimeout(() => {
        if (!this._stopped) this.start()
      }, RETRY_TIME)
    }

    this.task = this.createProcess().then(stopCallback, stopCallback)
    this.dispatchEvent(new CustomEvent('running'))
    // eslint-disable-next-line no-console
    console.log('Server started')
  }

  public getPID(): Promise<string[]> {
    return queryPID(SERVER_FILENAME)
  }

  public async kill() {
    this._stopped = true
    await Promise.all(
      (await this.getPID()).map(async (pid) => {
        await betterncm.app.exec(`taskkill /F /PID ${pid}`)
      }),
    )
  }
}

export const backendSvrManager = new BackendSvrManager()
