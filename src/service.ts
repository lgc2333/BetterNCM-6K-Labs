import { provider } from './info-provider'
import { TypedEventTarget } from './utils'

export const SERVER_PORT = 9863
export const RETRY_TIME = 3000

export interface Message {
  type: string
  data: any
  echo?: any
}

export interface Answer {
  data: any
  echo?: any
}

//

export interface MessageEventMap {
  query: any
}

export type WSCustomEvent<T> = CustomEvent<{
  ws: WebSocket
  data: T
  answer: (data: any) => void
}>
export type ConnectionEventMap = {
  open: CustomEvent<undefined>
  close: CustomEvent<undefined>
}
export type MessageEventMapType = {
  [k in keyof MessageEventMap as `api/${k}`]: WSCustomEvent<MessageEventMap[k]>
} & ConnectionEventMap

//

export function isMessage(data: any): data is Message {
  return typeof data === 'object' && data !== null && 'type' in data && 'data' in data
}

export class WebsocketService extends TypedEventTarget<MessageEventMapType> {
  public ws?: WebSocket

  private _stopped = true

  public get connected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  public get stopped() {
    return this._stopped
  }

  protected closeListener = (ev: CloseEvent) => {
    this.dispatchCustomEvent('close', {})
    if (this._stopped) return
    // eslint-disable-next-line no-console
    console.log(
      `Connection closed, reconnect in ${RETRY_TIME}ms.` +
        ` code: ${ev.code}, reason: ${ev.reason}`,
    )
    setTimeout(() => {
      if (!this._stopped) this.reconnect()
    }, RETRY_TIME)
  }

  protected createAnswerFunc(ws: WebSocket, message: Message) {
    return (data: any) => {
      const answer = { data, echo: message.echo } satisfies Answer
      ws.send(JSON.stringify(answer))
    }
  }

  protected handle = (ev: MessageEvent) => {
    let data: any
    try {
      data = JSON.parse(ev.data)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to parse message', ev.data)
      return
    }

    if (!isMessage(data)) {
      // eslint-disable-next-line no-console
      console.error('Invalid message', data)
      return
    }

    this.dispatchCustomEvent(`api/${data.type}` as any, {
      detail: {
        ws: this.ws!,
        data: data.data,
        answer: this.createAnswerFunc(this.ws!, data),
      },
    })
  }

  public shutdown() {
    this._stopped = true
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.removeEventListener('close', this.closeListener)
      this.ws.close()
      // eslint-disable-next-line no-console
      console.log('Connection manually shutdown')
    }
    this.dispatchCustomEvent('close', {})
    this.ws = undefined
  }

  public reconnect() {
    this.shutdown()
    this._stopped = false
    this.ws = new WebSocket(`ws://localhost:${SERVER_PORT}/backend-connect`)
    this.ws.addEventListener('close', this.closeListener)
    this.ws.addEventListener('open', () => {
      this.dispatchCustomEvent('open', {})
      // eslint-disable-next-line no-console
      console.log('Connected to backend server')
    })
    this.ws.addEventListener('message', this.handle)
  }
}

export const websocketService = new WebsocketService()

websocketService.addEventListener('api/query', (ev) => {
  const { answer } = ev.detail
  answer(provider.query())
})
