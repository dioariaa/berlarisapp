const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const monthFormatter = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
})

export function parseLocalDate(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

export function formatDate(date: string): string {
  return dateFormatter.format(parseLocalDate(date))
}

export function formatMonth(date: Date): string {
  return monthFormatter.format(date)
}

export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calculateTotalDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const start = parseLocalDate(startDate)
  const end = parseLocalDate(endDate)
  const difference = end.getTime() - start.getTime()
  if (difference < 0) return 0
  return Math.floor(difference / 86_400_000) + 1
}

export function isDateInRange(date: string, startDate: string, endDate: string): boolean {
  return date >= startDate && date <= endDate
}

export function recordOverlapsMonth(startDate: string, endDate: string, month: string): boolean {
  if (!month) return true
  const monthStart = `${month}-01`
  const [year, monthNumber] = month.split('-').map(Number)
  const monthEnd = toISODate(new Date(year, monthNumber, 0))
  return startDate <= monthEnd && endDate >= monthStart
}
