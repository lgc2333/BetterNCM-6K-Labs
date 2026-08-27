import { Icon as IconifyIcon } from '@iconify/react'

/**
 * Iconify adapter for the config panel. Icons load on demand from the
 * Iconify API and stay blank until their data arrives (decorative only).
 * The `sixk-icon` span shell keeps the scoped CSS (`.sixk-icon svg`) in charge
 * of sizing and color inheritance.
 */
export function Icon(props: { name: string }) {
  return (
    <span className="sixk-icon">
      <IconifyIcon icon={props.name} aria-hidden="true" />
    </span>
  )
}
