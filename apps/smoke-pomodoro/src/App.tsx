import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Mode = 'work' | 'break'

const DURATIONS: Record<Mode, number> = { work: 25 * 60, break: 5 * 60 }
const LABELS: Record<Mode, string> = { work: 'Work', break: 'Break' }

function format(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function App() {
  const [mode, setMode] = useState<Mode>('work')
  const [remaining, setRemaining] = useState(DURATIONS.work)
  // Wall-clock deadline while running, so throttled background tabs stay accurate.
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const running = endsAt !== null
  const done = remaining === 0

  useEffect(() => {
    if (endsAt === null) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) setEndsAt(null)
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [endsAt])

  useEffect(() => {
    const state = done ? 'Done' : running ? LABELS[mode] : 'Paused'
    document.title = `${format(remaining)} · ${state} — Pomodoro`
  }, [remaining, running, mode, done])

  const start = () => {
    if (done) return
    setEndsAt(Date.now() + remaining * 1000)
  }
  const pause = () => setEndsAt(null)
  const reset = () => {
    setEndsAt(null)
    setRemaining(DURATIONS[mode])
  }
  const switchMode = (next: Mode) => {
    setEndsAt(null)
    setMode(next)
    setRemaining(DURATIONS[next])
  }

  const progress = 1 - remaining / DURATIONS[mode]
  const status = done ? 'Done' : running ? 'Running' : 'Paused'

  return (
    <main
      className={cn(
        'flex min-h-svh items-center justify-center p-4 transition-colors duration-500',
        mode === 'work' ? 'bg-rose-50' : 'bg-emerald-50',
      )}
    >
      <div className="w-full max-w-sm rounded-2xl border bg-background p-8 shadow-sm">
        <div className="mb-8 flex rounded-lg bg-muted p-1" role="tablist">
          {(Object.keys(DURATIONS) as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => switchMode(m)}
              className={cn(
                'flex-1 rounded-md py-1.5 text-sm font-medium transition-colors',
                mode === m
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {LABELS[m]} · {DURATIONS[m] / 60}m
            </button>
          ))}
        </div>

        <div className="mb-2 flex items-center justify-center gap-2 text-sm">
          <span
            className={cn(
              'size-2 rounded-full',
              running
                ? 'animate-pulse bg-green-500'
                : done
                  ? 'bg-blue-500'
                  : 'bg-amber-400',
            )}
          />
          <span className="font-medium text-muted-foreground" data-testid="status">
            {status}
          </span>
        </div>

        <div
          className={cn(
            'text-center font-mono text-7xl font-semibold tabular-nums tracking-tight transition-opacity',
            !running && !done && 'opacity-60',
          )}
          data-testid="time"
        >
          {format(remaining)}
        </div>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full transition-[width] duration-300',
              mode === 'work' ? 'bg-rose-500' : 'bg-emerald-500',
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <div className="mt-8 flex gap-2">
          {running ? (
            <Button size="lg" className="flex-1" onClick={pause}>
              <Pause /> Pause
            </Button>
          ) : (
            <Button size="lg" className="flex-1" onClick={start} disabled={done}>
              <Play /> Start
            </Button>
          )}
          <Button size="lg" variant="outline" onClick={reset}>
            <RotateCcw /> Reset
          </Button>
        </div>
      </div>
    </main>
  )
}
