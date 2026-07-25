import type { StudentEducation } from '../types'

const value = (input: string | number | null | undefined) => String(input ?? '').trim()

export function formatGraduationYear(year?: number | string | null) {
  if (year === null || year === undefined || value(year) === '') return null
  const graduationYear = Number(year)
  const currentYear = new Date().getFullYear()
  if (!Number.isInteger(graduationYear) || graduationYear <= 0) return null
  return graduationYear < currentYear
    ? `Graduated in ${graduationYear}`
    : `Graduating in ${graduationYear}`
}

export function educationLines(education: StudentEducation | null | undefined) {
  if (!education) return []
  const college = value(education.college)
  const degree = value(education.degree)
  const branch = value(education.branch)
  const graduationYear = formatGraduationYear(education.graduationYear)
  const qualification = degree && branch ? `${degree} in ${branch}` : degree || branch
  return [qualification, college, graduationYear].filter((line): line is string => Boolean(line))
}
