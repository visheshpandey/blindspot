import { useMemo } from 'react'
import { ChevronRight, Download, UsersRound } from 'lucide-react'
import { formatWhen } from '../domain/cases'
import { boardCsv, groupByStudent, summarise } from '../domain/counsellor'
import { EmptyState, MetricCard, PageHero, VerdictChip } from '../components/common/ui'

/** One board for many applicants: who needs attention first, and what is still open for each. */
export default function Counsellor({ cases, labels, onOpen, onNew, demoMode }) {
  const groups = useMemo(() => groupByStudent(cases, labels), [cases, labels])
  const needAction = groups.filter((g) => g.urgency <= 1).length
  const download = () => {
    const blob = new Blob([String.fromCharCode(0xFEFF), boardCsv(groups)], { type: 'text/csv;charset=utf-8' })
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `blindspot-counsellor-board-${new Date().toISOString().slice(0, 10)}.csv` })
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href)
  }
  return <div className="counsellor-page">
    <PageHero icon={UsersRound} tone="teal" title="Counsellor board" lede="Helping many applicants? Tag each case with a student's name in its report. This board shows who needs attention first and what is still open.">
      {cases.length > 0 && <button className="secondary-button" onClick={download}><Download size={14} aria-hidden="true" /> Download CSV</button>}
    </PageHero>
    {cases.length === 0 ? <EmptyState icon={UsersRound} title="No cases to show yet" action={<button className="primary-button" onClick={onNew}>Start an investigation</button>}>
      Run a case, open its report and type a student's name. {!demoMode && 'Or turn on Demo mode in settings to see a sample board.'}
    </EmptyState> : <>
      <div className="history-stats">
        <MetricCard label="STUDENTS" value={groups.filter((g) => g.name !== 'Unassigned').length} foot="With tagged cases" icon={UsersRound} />
        <MetricCard label="NEED ACTION" value={needAction} foot="Not ready or insufficient" icon={UsersRound} tone="metric-red" />
        <MetricCard label="CASES" value={cases.length} foot="On this board" icon={UsersRound} />
      </div>
      <div className="student-board">
        {groups.map((g) => <section key={g.name} className={`student-card u-${g.urgency}`} aria-label={`Student: ${g.name}`}>
          <header><h2>{g.name}</h2><span className="student-count">{g.blockers} open blocker{g.blockers === 1 ? '' : 's'}</span></header>
          <ul>
            {g.cases.map((c) => { const s = summarise(c); return <li key={c.investigation_id}>
              <button onClick={() => onOpen(c)}>
                <span className="student-case"><b>{c.title}</b><small>{c.demo_run ? 'Saved demo run' : formatWhen(c.saved_at || c.generated_at)} · {c.coverage}% coverage</small>
                  {s.open.length > 0 && <small className="student-open">Open: {s.open.slice(0, 3).join(' · ')}{s.open.length > 3 ? ` +${s.open.length - 3}` : ''}</small>}</span>
                <VerdictChip verdict={c.verdict} /><ChevronRight size={15} aria-hidden="true" />
              </button>
            </li> })}
          </ul>
        </section>)}
      </div>
    </>}
  </div>
}
