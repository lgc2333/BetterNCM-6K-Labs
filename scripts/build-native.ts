import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

// BetterNCM's plugin manager loads `manifest.native_plugin` first and falls back to the
// same file name suffixed with ".x64.dll" on 64-bit hosts (PluginManager.cpp). We ship
// an ia32 DLL under the manifest name so 32-bit NCM installs work out of the box.
const TARGETS = [
  {
    target: 'i686-pc-windows-msvc',
    outputName: '6k-labs-native.dll',
  },
  {
    target: 'x86_64-pc-windows-msvc',
    outputName: '6k-labs-native.dll.x64.dll',
  },
] as const

const BINARY_NAME = 'better_ncm_6k_labs_native.dll'

async function buildTarget(target: string): Promise<void> {
  const result = spawnSync(
    'cargo',
    [
      'build',
      '--manifest-path',
      './native/Cargo.toml',
      '--release',
      '--target',
      target,
      '--target-dir',
      './native/target',
    ],
    { stdio: 'inherit' },
  )
  if (result.status !== 0) {
    throw new Error(`cargo build failed for ${target} (exit ${result.status})`)
  }
}

async function copyBinary(target: string, outputName: string): Promise<void> {
  const sourcePath = path.join(
    process.cwd(),
    'native/target',
    target,
    'release',
    BINARY_NAME,
  )
  await fs.copyFile(sourcePath, path.join(process.cwd(), 'dist', outputName))
}

async function main(): Promise<void> {
  for (const { target } of TARGETS) {
    await buildTarget(target)
  }

  await fs.mkdir(path.join(process.cwd(), 'dist'), { recursive: true })
  for (const { target, outputName } of TARGETS) {
    await copyBinary(target, outputName)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
