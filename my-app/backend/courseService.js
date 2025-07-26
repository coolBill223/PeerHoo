const BASE   = 'https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s';
const PATH   = 'WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch';
const TERM   = '1258';  // 2025 Fall academic term code

/**
 * Converts raw time string from SIS into human-readable HH:MM format.
 * 
 * @param {string} raw - Time string in format like "13.30.00.000000" (24-hour format with seconds and millis)
 * @returns {string} - Formatted time string like "13:30"
 */
function formatTime(raw) {
  if (!raw || typeof raw !== 'string') return '';  // Avoid crash on invalid input
  const parts = raw.split('.')[0].split('.');
  const hour = parts[0] ?? '00';
  const minute = parts[1]?.padStart(2, '0') ?? '00';
  return `${hour}:${minute}`;
}

/**
 * Fetches all available class sections for a given subject and catalog number (e.g., CS 2100).
 * It handles pagination and filters out unnecessary sections.
 * 
 * @param {string} subject - Course subject code, e.g., "CS"
 * @param {string} catalog - Course catalog number, e.g., "2100"
 * @returns {Promise<Array>} - An array of filtered course section info
 *   Each section contains: subject, catalog, section, classNbr, component, description, days, times, and instructor
 */
export const getCourseSections = async (subject, catalog) => {
  let page = 1;
  const all = [];

  // Loop through all pages of results from UVA SIS API
  while (true) {
    const url = `https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch?institution=UVA01&term=1258&subject=${subject}&catalog_nbr=${catalog}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`); // Handle failed requests

    const json = await res.json();
    const courses = Array.isArray(json.classes) ? json.classes : [];

    if (courses.length === 0) break; // End loop if no more classes found
    all.push(...courses);
    page++;
  }

  // Prioritize LEC (lecture) sections; only use LAB if no LEC exists for same section 
  const lecOnly = all.filter(c => c.component === 'LEC');
  const labOnly = all.filter(c => c.component === 'LAB' && !all.some(d => d.class_section === c.class_section && d.component === 'LEC'));

  const filtered = lecOnly.length > 0 ? lecOnly : labOnly;

  // Format and return cleaned data
  return filtered.map((c) => ({
    subject:     c.subject,
    catalog:     c.catalog_nbr,
    section:     c.class_section,
    classNbr:    c.class_nbr,
    component:   c.component,
    descr:       c.descr,
    meetDays:    c.meetings?.[0]?.days ?? 'TBA',
    startTime:   formatTime(c.meetings?.[0]?.start_time),
    endTime:     formatTime(c.meetings?.[0]?.end_time),
    instructor:  c.meetings?.[0]?.instructor ?? c.instructors?.[0]?.name ?? 'TBA'
  }));
};
