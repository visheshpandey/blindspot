// Every localStorage key the app uses, in one place. Bump the version suffix when a stored shape changes.
export const KEYS = {
  history: 'blindspot.history.v1',
  saved: 'blindspot.saved.v1',
  savedSeeded: 'blindspot.saved.seeded',
  students: 'blindspot.students.v1',
  lang: 'blindspot.lang',
  demoMode: 'blindspot.demoMode',
  reportView: 'blindspot.report.view',
  tourSeen: 'blindspot.tour.seen',
  translationPrefix: 'blindspot.tr.',
}

export const translationKey = (caseId, lang) => `${KEYS.translationPrefix}v2.${caseId}.${lang}`
