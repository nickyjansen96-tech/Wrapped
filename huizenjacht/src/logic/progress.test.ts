import { describe, expect, it } from 'vitest'
import type { Task } from '../domain/types'
import { isOverdue, progressOf, progressPerPhase } from './progress'

const t = (over: Partial<Task>): Task => ({ id: Math.random().toString(), phaseId: 'p1', title: 'x', status: 'todo', ...over })

describe('voortgang', () => {
  it('telt klaar t.o.v. relevante taken, n.v.t. telt niet mee', () => {
    const p = progressOf([t({ status: 'klaar' }), t({ status: 'bezig' }), t({ status: 'nvt' }), t({ status: 'klaar' })])
    expect(p).toMatchObject({ done: 2, total: 3, percentage: 67 })
  })
  it('telt kosten op (behalve n.v.t.)', () => {
    expect(progressOf([t({ cost: 450 }), t({ cost: 1200, status: 'klaar' }), t({ cost: 99, status: 'nvt' })]).cost).toBe(1650)
  })
  it('lege fase = 0%', () => {
    expect(progressOf([]).percentage).toBe(0)
  })
  it('per fase', () => {
    const r = progressPerPhase(
      [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }],
      [t({ status: 'klaar' }), t({ phaseId: 'p2' })],
    )
    expect(r.map((x) => x.progress.percentage)).toEqual([100, 0])
  })
  it('te laat', () => {
    expect(isOverdue(t({ deadline: '2026-01-01' }), '2026-02-01')).toBe(true)
    expect(isOverdue(t({ deadline: '2026-01-01', status: 'klaar' }), '2026-02-01')).toBe(false)
    expect(isOverdue(t({}), '2026-02-01')).toBe(false)
  })
})
