export interface EventListenerFunc<TE extends Event = Event> {
  (evt: TE): void
}

export interface EventListenerObject<TE extends Event = Event> {
  handleEvent(object: TE): void
}

export type EventListener<TE extends Event = Event> =
  | EventListenerFunc<TE>
  | EventListenerObject<TE>

export class TypedEventTarget<E extends { [key: string]: Event }> extends EventTarget {
  public override addEventListener<K extends keyof E>(
    type: K,
    callback: EventListener<E[K]> | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type as string, callback as any, options)
  }

  public override removeEventListener<K extends keyof E>(
    type: K,
    callback: EventListener<E[K]> | null,
    options?: EventListenerOptions | boolean,
  ): void {
    super.removeEventListener(type as string, callback as any, options)
  }

  public dispatchCustomEvent<K extends keyof E>(
    type: K,
    init: CustomEventInit<E[K] extends CustomEvent<infer D> ? D : never>,
  ): boolean {
    return this.dispatchEvent(new CustomEvent(type as string, init))
  }
}
