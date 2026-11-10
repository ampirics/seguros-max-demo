"use client"

import { ReportBugButton } from '@/components/report-bug-button'

interface BugReportProviderProps {
  children: React.ReactNode
  showReportButton?: boolean
}

export function BugReportProvider({ children, showReportButton = true }: BugReportProviderProps) {
  return (
    <>
      {children}
      {showReportButton && <ReportBugButton />}
    </>
  )
}
