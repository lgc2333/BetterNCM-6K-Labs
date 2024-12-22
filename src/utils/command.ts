import {
  ensureTmpDir,
  randomChars,
  waitForFunction,
  WaitForFunctionOptions,
} from './common'

export interface CommandResult {
  success: boolean
  output: string
}

export const captureScriptTemplate = `
$command = "{{command}}";
$filePath = "{{filePath}}";
$output = New-Object System.Text.StringBuilder;
try {
  $processOutput = Invoke-Expression $command 2>&1;
  $isSuccess = $?;
  $output.Append($processOutput -join "\`n");
} catch {
  $isSuccess = $False;
  $output.Append($_.Exception.Message);
};
$result = [PSCustomObject]@{
  success = $isSuccess;
  output  = ($output.ToString() -replace "\`r\`n", "\`n");
};
$result | ConvertTo-Json -Compress | Out-File -Encoding utf8 -FilePath $filePath;`
  .trim()
  .replace(/\n\s*/g, ' ')

export function escapePowershellInput(input: string): string {
  return `${input.replaceAll('`', '``').replaceAll('"', '`"')}`
}

export function prepareCommand(command: string, filePath: string): string {
  return captureScriptTemplate
    .replaceAll('\n', ' ; ')
    .replaceAll('{{command}}', escapePowershellInput(command))
    .replaceAll('{{filePath}}', escapePowershellInput(filePath))
}

export interface WaitOutFileOptions extends WaitForFunctionOptions {
  /** default true */
  shouldDelete?: boolean
}

export async function waitOutFile(
  filePath: string,
  opts?: WaitOutFileOptions,
): Promise<string> {
  const { delay = 200, times = 15, shouldDelete = true } = opts ?? {}

  const res = await waitForFunction(
    async () => {
      if (await betterncm.fs.exists(filePath)) {
        // 有时会 500 读不到，这时可能返回的是空字符串，也过滤掉
        return betterncm.fs.readFileText(filePath).then((x) => x.trim())
      }
    },
    { delay, times },
  )
  // if (globalThis.SixKLabs) {
  //   console.log('waitOutFile', filePath, res)
  // }

  if (shouldDelete) {
    // 有时也会删不掉
    await waitForFunction(
      async () => {
        await betterncm.fs.remove(filePath)
        return !(await betterncm.fs.exists(filePath))
      },
      { delay, times },
    ).catch(console.error) // ignore error
  }

  return res
}

export async function getCmdTmpDir(): Promise<string> {
  return `${await ensureTmpDir()}/commandCache`
}

export async function ensureCmdTmpDir(): Promise<string> {
  const path = await getCmdTmpDir()
  if (!(await betterncm.fs.exists(path))) {
    await betterncm.fs.mkdir(path)
  }
  return path
}

export async function removeCmdTmpDir(): Promise<void> {
  const path = await getCmdTmpDir()
  if (await betterncm.fs.exists(path)) {
    await betterncm.fs.remove(path)
  }
}

export async function genCmdTmpFilePath(): Promise<string> {
  return `${await ensureCmdTmpDir()}/${randomChars(8)}.tmp`
}

export interface RunPowershellOptions {
  check: boolean
}

export class CommandFailedError extends Error {
  name = 'CommandFailedError'

  constructor(
    public command: string,
    public output: string,
  ) {
    super(`A command failed: \nCommand: ${command}\nOutput: ${output}`)
  }
}

export async function runPowershellWithOutput(
  command: string,
  options?: RunPowershellOptions,
): Promise<CommandResult> {
  const { check = true } = options ?? {}

  const scriptFilePath = await genCmdTmpFilePath()
  const outFilePath = await genCmdTmpFilePath()
  const script = prepareCommand(command, outFilePath)
  await betterncm.fs.writeFileText(scriptFilePath, script)
  await betterncm.app.exec(
    `powershell -Command "Get-Content -Path ${scriptFilePath} -Encoding utf8 | Invoke-Expression"`,
  )
  // if (globalThis.SixKLabs) {
  //   console.log('runPowershellWithOutput', outFilePath, command)
  // }

  let res: CommandResult
  try {
    res = JSON.parse(await waitOutFile(outFilePath))
  } catch (e) {
    console.error(e)
    if (check) throw e
    return { success: false, output: `${e}` }
  } finally {
    await betterncm.fs.remove(scriptFilePath).catch(console.error)
  }
  if (check && !res.success) {
    throw new CommandFailedError(command, res.output)
  }
  return res
}
