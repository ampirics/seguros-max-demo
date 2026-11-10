'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, Check, Loader2 } from 'lucide-react'

// El último paso es el que está en curso; los anteriores ya terminaron.
export function IaPensando({ pasos, seguir = true }: { pasos: string[]; seguir?: boolean }) {
  const [visibles, setVisibles] = useState(1)
  useEffect(() => {
    setVisibles(1)
    const timer = setInterval(() => setVisibles((n) => (n < pasos.length ? n + 1 : n)), 900)
    return () => clearInterval(timer)
  }, [pasos.join('|')])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (seguir) ref.current?.scrollIntoView({ block: 'nearest' }) }, [visibles])

  return (
    <div ref={ref} className="flex justify-end" role="status" aria-live="polite">
      <div className="max-w-[75%] rounded-lg rounded-tr-sm bg-accent px-3 py-2 text-sm shadow-sm">
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Bot className="h-3 w-3" aria-hidden /> La IA está pensando
        </p>
        <ol className="space-y-0.5">
          {pasos.slice(0, visibles).map((paso, i) => {
            const enCurso = i === visibles - 1
            return (
              <li key={paso} className="flex items-center gap-1.5 text-[13px]">
                {enCurso ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary motion-reduce:animate-none" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                )}
                <span className={enCurso ? 'text-foreground' : 'text-muted-foreground'}>{paso}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
