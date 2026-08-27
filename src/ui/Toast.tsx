/**
 * Toast notification module: owns the message state, the auto-dismiss timer,
 * and its cleanup. Callers get `showToast(message)` and a renderable element.
 */
export function useToast(durationMs: number): {
  toastMessage: string
  showToast: (message: string) => void
} {
  const [toastMessage, setToastMessage] = React.useState('')
  const toastTimer = React.useRef<number | undefined>(undefined)

  React.useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const showToast = (message: string) => {
    setToastMessage(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(setToastMessage, durationMs, '')
  }

  return { toastMessage, showToast }
}

export function Toast(props: { message: string }) {
  return props.message ? <div className="sixk-toast">{props.message}</div> : null
}
