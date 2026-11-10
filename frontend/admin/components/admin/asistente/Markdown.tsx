import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g

function inline(texto: string, clave = ''): ReactNode[] {
  return texto.split(INLINE).filter(Boolean).map((parte, i) => {
    const k = `${clave}-${i}`
    if (/^(\*\*|__)/.test(parte)) return <strong key={k} className="font-semibold">{inline(parte.slice(2, -2), k)}</strong>
    if (parte.startsWith('`')) return <code key={k} className="rounded bg-secondary px-1 font-mono text-[12px]">{parte.slice(1, -1)}</code>
    const enlace = parte.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
    if (enlace) {
      const seguro = /^(https?:|\/|mailto:)/.test(enlace[2])
      return seguro
        ? <a key={k} href={enlace[2]} target={enlace[2].startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">{enlace[1]}</a>
        : <Fragment key={k}>{enlace[1]}</Fragment>
    }
    if (/^[*_].+[*_]$/.test(parte) && parte.length > 2) return <em key={k}>{inline(parte.slice(1, -1), k)}</em>
    return <Fragment key={k}>{parte}</Fragment>
  })
}

const celdas = (fila: string) => fila.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
const esSeparador = (fila: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(fila)
const esLista = (l: string) => /^\s*([-*+]|\d+[.)])\s+/.test(l)

export function Markdown({ texto, className }: { texto: string; className?: string }) {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n')
  const bloques: ReactNode[] = []
  let i = 0
  while (i < lineas.length) {
    const linea = lineas[i]
    const k = `b${i}`
    if (!linea.trim()) { i++; continue }

    if (linea.trim().startsWith('```')) {
      const codigo: string[] = []
      i++
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) codigo.push(lineas[i++])
      i++
      bloques.push(<pre key={k} className="overflow-x-auto rounded-md bg-secondary p-2 font-mono text-[12px]">{codigo.join('\n')}</pre>)
      continue
    }

    const titulo = linea.match(/^(#{1,4})\s+(.*)$/)
    if (titulo) {
      bloques.push(<p key={k} className={cn('font-semibold', titulo[1].length <= 2 ? 'text-base' : 'text-sm')}>{inline(titulo[2], k)}</p>)
      i++
      continue
    }

    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(linea)) {
      bloques.push(<hr key={k} className="border-border" />)
      i++
      continue
    }

    if (linea.includes('|') && i + 1 < lineas.length && esSeparador(lineas[i + 1])) {
      const cabecera = celdas(linea)
      const filas: string[][] = []
      i += 2
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim()) filas.push(celdas(lineas[i++]))
      bloques.push(
        <div key={k} className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-max border-collapse text-[13px]">
            <thead>
              <tr className="border-b">
                {cabecera.map((c, j) => <th key={j} scope="col" className="px-2 py-1 text-left font-semibold">{inline(c, `${k}h${j}`)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filas.map((f, r) => (
                <tr key={r}>
                  {cabecera.map((_, j) => <td key={j} className="px-2 py-1 align-top tabular-nums">{inline(f[j] ?? '', `${k}r${r}c${j}`)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    if (esLista(linea)) {
      const ordenada = /^\s*\d+[.)]/.test(linea)
      const items: string[] = []
      while (i < lineas.length && (esLista(lineas[i]) || (lineas[i].startsWith('  ') && lineas[i].trim() && items.length))) {
        if (esLista(lineas[i])) items.push(lineas[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''))
        else items[items.length - 1] += ` ${lineas[i].trim()}`
        i++
      }
      const Lista = ordenada ? 'ol' : 'ul'
      bloques.push(
        <Lista key={k} className={cn('space-y-0.5 pl-5', ordenada ? 'list-decimal' : 'list-disc')}>
          {items.map((t, j) => <li key={j}>{inline(t, `${k}l${j}`)}</li>)}
        </Lista>
      )
      continue
    }

    const parrafo: string[] = []
    while (i < lineas.length && lineas[i].trim() && !esLista(lineas[i]) && !/^#{1,4}\s/.test(lineas[i])
      && !lineas[i].trim().startsWith('```') && !(lineas[i].includes('|') && i + 1 < lineas.length && esSeparador(lineas[i + 1]))) {
      parrafo.push(lineas[i++])
    }
    bloques.push(
      <p key={k}>
        {parrafo.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${k}p${j}`)}</Fragment>)}
      </p>
    )
  }
  return <div className={cn('space-y-2 break-words', className)}>{bloques}</div>
}
