export const normalizeQuery = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function matchesTool(text, query, ready, state='all') {
  const words=normalizeQuery(query).split(/\s+/).filter(Boolean);
  return (state==='all' || (state==='ready' ? ready : !ready)) && words.every(word=>normalizeQuery(text).includes(word));
}
