const BASE   = 'https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s';
const PATH   = 'WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch';
const TERM   = '1258';          // 2025 Fall

/**
 * get all the classes based on user input
 * @param {string} subject   e.g. "CS"
 * @param {string} catalog   e.g. "2100"
 * @returns {Promise<Array>} section/time
 */
function formatTime(raw) {
  if (!raw || typeof raw !== 'string') return '';  // avoid undefined or null
  const parts = raw.split('.')[0].split('.');
  const hour = parts[0] ?? '00';
  const minute = parts[1]?.padStart(2, '0') ?? '00';
  return `${hour}:${minute}`;
}


export const getCourseSections = async (subject, catalog) => {
  let page = 1;
  const all = [];

  while (true) {
    const url = `https://sisuva.admin.virginia.edu/psc/ihprd/UVSS/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch?institution=UVA01&term=1258&subject=${subject}&catalog_nbr=${catalog}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const courses = Array.isArray(json.classes) ? json.classes : [];
    if (courses.length === 0) break;
    all.push(...courses);
    page++;
  }

  // check：LEC/LAB 
  const lecOnly = all.filter(c => c.component === 'LEC');
  const labOnly = all.filter(c => c.component === 'LAB' && !all.some(d => d.class_section === c.class_section && d.component === 'LEC'));

  const filtered = lecOnly.length > 0 ? lecOnly : labOnly;

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
  }));
};
