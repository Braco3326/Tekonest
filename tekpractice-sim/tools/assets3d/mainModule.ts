/**
 * assets3d/mainModule: the CLI entry guard shared by the tools scripts. Deliberately light (node:path and node:url
 * only) so a script can import it without pulling in sharp, Draco or Blender helpers.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * True when the module at `moduleUrl` is the script node was started with (`argv1` is `process.argv[1]`). On Windows
 * the comparison ignores case (the drive letter of `process.argv[1]` and of the module URL can differ), so a CLI never
 * silently does nothing.
 */
export function isMainModule(argv1: string | undefined, moduleUrl: string, platform: NodeJS.Platform = process.platform): boolean {
  if (!argv1) return false
  const win = platform === 'win32'
  const a = (win ? path.win32 : path.posix).resolve(argv1)
  const b = fileURLToPath(moduleUrl, { windows: win })
  return win ? a.toLowerCase() === b.toLowerCase() : a === b
}
