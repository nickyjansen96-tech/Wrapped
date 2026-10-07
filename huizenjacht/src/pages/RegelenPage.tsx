import { useState } from 'react'
import { Field, NumberInput, ProgressBar, Segmented, Sheet } from '../components/ui'
import { TASK_STATUSES, type Task, type TaskStatus } from '../domain/types'
import { euro, formatDate } from '../logic/format'
import { isOverdue, progressOf, progressPerPhase } from '../logic/progress'
import { newId, useStore } from '../state/store'

const today = () => new Date().toISOString().slice(0, 10)

export function RegelenPage() {
  const { data, update } = useStore()
  const [editing, setEditing] = useState<Task | null>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const total = progressOf(data.tasks)
  const perPhase = progressPerPhase(data.phases, data.tasks)
  const now = today()

  const saveTask = (t: Task) =>
    update((d) => ({
      ...d,
      tasks: d.tasks.some((x) => x.id === t.id) ? d.tasks.map((x) => (x.id === t.id ? t : x)) : [...d.tasks, t],
    }))

  // Standaard staat de eerste fase met openstaande taken open.
  const firstOpen = perPhase.find((p) => p.progress.done < p.progress.total)?.phase.id
  const isOpen = (id: string) => open[id] ?? id === firstOpen

  return (
    <div className="stack">
      <section className="card stack">
        <div className="card-head">
          <h2>Totale voortgang</h2>
          <span className="num">
            {total.done} / {total.total} · {total.percentage}%
          </span>
        </div>
        <ProgressBar value={total.percentage} label="Totale voortgang" />
        {total.cost > 0 && <p className="small muted">Ingevulde kosten: {euro(total.cost)}</p>}
      </section>

      {perPhase.map(({ phase, progress }) => {
        const tasks = data.tasks.filter((t) => t.phaseId === phase.id)
        const expanded = isOpen(phase.id)
        return (
          <section key={phase.id} className="card">
            <button
              className="card-head clickable"
              style={{ width: '100%', background: 'none', border: 'none', padding: 0 }}
              aria-expanded={expanded}
              onClick={() => setOpen({ ...open, [phase.id]: !expanded })}
            >
              <h2>
                {expanded ? '▾' : '▸'} {phase.name}
              </h2>
              <span className="small muted num">
                {progress.done}/{progress.total}
                {progress.cost > 0 && ` · ${euro(progress.cost)}`}
              </span>
            </button>
            <ProgressBar value={progress.percentage} label={`Voortgang ${phase.name}`} />
            {expanded && (
              <>
                <ul className="list" style={{ marginTop: 8 }}>
                  {tasks.map((t) => (
                    <li key={t.id} className="row">
                      <input
                        type="checkbox"
                        className="check"
                        checked={t.status === 'klaar'}
                        aria-label={`${t.title} klaar`}
                        onChange={(e) => saveTask({ ...t, status: e.target.checked ? 'klaar' : 'todo' })}
                      />
                      <button className="row-main" onClick={() => setEditing(t)}>
                        <span
                          className="row-title"
                          style={
                            t.status === 'klaar' || t.status === 'nvt'
                              ? { textDecoration: 'line-through', color: 'var(--muted)' }
                              : undefined
                          }
                        >
                          {t.title}
                        </span>
                        <TaskMeta task={t} overdue={isOverdue(t, now)} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  className="btn-link"
                  onClick={() => setEditing({ id: newId('t'), phaseId: phase.id, title: '', status: 'todo' })}
                >
                  + Taak toevoegen
                </button>
              </>
            )}
          </section>
        )
      })}

      {editing && (
        <TaskSheet
          task={editing}
          isNew={!data.tasks.some((t) => t.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={(t) => {
            saveTask(t)
            setEditing(null)
          }}
          onDelete={() => {
            update((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== editing.id) }))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function TaskMeta({ task, overdue }: { task: Task; overdue: boolean }) {
  const parts = []
  if (task.status === 'bezig') parts.push(<span key="s" className="chip chip-warn">Bezig</span>)
  if (task.status === 'nvt') parts.push(<span key="s" className="chip">N.v.t.</span>)
  if (task.deadline)
    parts.push(
      <span key="d" className={overdue ? 'overdue' : undefined}>
        {overdue ? 'Te laat: ' : 'Deadline '}
        {formatDate(task.deadline)}
      </span>,
    )
  if (task.contact) parts.push(<span key="c">{task.contact}</span>)
  if (task.cost) parts.push(<span key="k">{euro(task.cost)}</span>)
  if (task.note) parts.push(<span key="n">📝</span>)
  if (!parts.length) return null
  return <span className="row-sub">{parts}</span>
}

function TaskSheet({
  task,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  task: Task
  isNew: boolean
  onClose: () => void
  onSave: (t: Task) => void
  onDelete: () => void
}) {
  const { data } = useStore()
  const [t, setT] = useState<Task>(task)
  return (
    <Sheet title={isNew ? 'Taak toevoegen' : 'Taak'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (t.title.trim()) onSave({ ...t, title: t.title.trim() })
        }}
      >
        <Field label="Taak">
          <input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} required autoFocus={isNew} />
        </Field>
        {t.info && <p className="small muted">ℹ️ {t.info}</p>}
        <Field label="Status">
          <Segmented<TaskStatus>
            small
            value={t.status}
            onChange={(status) => setT({ ...t, status })}
            options={TASK_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
          />
        </Field>
        <div className="row-2">
          <Field label="Deadline">
            <input type="date" value={t.deadline ?? ''} onChange={(e) => setT({ ...t, deadline: e.target.value || undefined })} />
          </Field>
          <Field label="Kosten">
            <NumberInput value={t.cost} onChange={(cost) => setT({ ...t, cost })} suffix="€" />
          </Field>
        </div>
        <Field label="Contactpersoon / bedrijf">
          <input value={t.contact ?? ''} onChange={(e) => setT({ ...t, contact: e.target.value })} placeholder="Naam, telefoon, e-mail" />
        </Field>
        <Field label="Notitie">
          <textarea rows={3} value={t.note ?? ''} onChange={(e) => setT({ ...t, note: e.target.value })} />
        </Field>
        <Field label="Fase">
          <select value={t.phaseId} onChange={(e) => setT({ ...t, phaseId: e.target.value })}>
            {data.phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="actions">
          {!isNew && (
            <button type="button" className="btn-danger" onClick={() => confirm(`"${t.title}" verwijderen?`) && onDelete()}>
              Verwijderen
            </button>
          )}
          <button type="submit" className="btn-primary">
            Opslaan
          </button>
        </div>
      </form>
    </Sheet>
  )
}
