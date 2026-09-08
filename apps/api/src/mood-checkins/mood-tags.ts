/// Fixed tag set for the mood check-in popup — no relational querying need,
/// so a plain string list (validated here, stored as a JSON array on
/// MoodCheckIn.tags) rather than a database-backed lookup table.
export const MOOD_TAGS = [
  'Appraisal Salary',
  'Appreciation',
  'Colleagues',
  'Employee engagement',
  'Extracurricular activities',
  'Facilities',
  'Growth',
  'Learning opportunity',
  'Management',
  'Other',
  'Reporting Manager',
  'Work environment',
  'Work timings',
  'Work-life balance',
] as const;
