import { CalendarCheck2, CalendarRange, Clock3 } from 'lucide-react'

interface SummaryCardsProps {
  monthlyCount: number
  activeToday: number
  usedDays: number
  monthLabel: string
}

export function SummaryCards({ monthlyCount, activeToday, usedDays, monthLabel }: SummaryCardsProps) {
  const cards = [
    {
      label: 'Total cuti bulan ini',
      value: monthlyCount,
      note: monthLabel,
      icon: CalendarRange,
      tone: 'blue',
    },
    {
      label: 'Sedang cuti hari ini',
      value: activeToday,
      note: activeToday ? 'Karyawan tidak masuk' : 'Tidak ada karyawan cuti',
      icon: CalendarCheck2,
      tone: 'green',
    },
    {
      label: 'Hari cuti terpakai',
      value: usedDays,
      note: 'Pada periode terpilih',
      icon: Clock3,
      tone: 'orange',
    },
  ]

  return (
    <section className="summary-grid" aria-label="Ringkasan data cuti">
      {cards.map(({ label, value, note, icon: Icon, tone }) => (
        <article className="summary-card" key={label}>
          <div className={`summary-card__icon summary-card__icon--${tone}`}>
            <Icon size={22} />
          </div>
          <div className="summary-card__body">
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        </article>
      ))}
    </section>
  )
}
