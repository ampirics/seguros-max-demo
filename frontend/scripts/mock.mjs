// Corre `next <args>` con NEXT_PUBLIC_MOCK=1 en cualquier sistema (Windows no entiende `VAR=1 cmd`).
import { spawn } from 'node:child_process'

const child = spawn(`npx next ${process.argv.slice(2).join(' ')}`, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NEXT_PUBLIC_MOCK: '1' },
})
child.on('exit', (code) => process.exit(code ?? 1))
