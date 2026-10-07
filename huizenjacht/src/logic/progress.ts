import type { Phase, Task } from '../domain/types'

export interface Progress {
  done: number
  total: number
  /** 0–100 */
  percentage: number
  cost: number
}

/** "N.v.t."-taken tellen niet mee voor de voortgang. */
export function progressOf(tasks: Task[]): Progress {
  const relevant = tasks.filter((t) => t.status !== 'nvt')
  const done = relevant.filter((t) => t.status === 'klaar').length
  const total = relevant.length
  const cost = tasks.reduce((s, t) => s + (t.status !== 'nvt' && t.cost ? t.cost : 0), 0)
  return { done, total, percentage: total ? Math.round((done / total) * 100) : 0, cost }
}

export function progressPerPhase(phases: Phase[], tasks: Task[]): { phase: Phase; progress: Progress }[] {
  return phases.map((phase) => ({ phase, progress: progressOf(tasks.filter((t) => t.phaseId === phase.id)) }))
}

/** Taken met deadline in het verleden die nog niet klaar zijn. */
export function isOverdue(task: Task, today: string): boolean {
  return !!task.deadline && task.deadline < today && task.status !== 'klaar' && task.status !== 'nvt'
}
