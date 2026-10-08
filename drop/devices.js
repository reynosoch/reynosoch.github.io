export function detectDevice(nav) {
  const ua = nav.userAgent || '';
  if (/iPad/i.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return {label:'iPad', type:'tablet'};
  if (/iPhone|iPod/i.test(ua)) return {label:'iPhone', type:'phone'};
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? {label:'Teléfono Android',type:'phone'} : {label:'Tablet Android',type:'tablet'};
  if (/Windows/i.test(ua)) return {label:'Laptop Windows',type:'computer'};
  if (/Mac/i.test(ua)) return {label:'Mac',type:'computer'};
  return {label:'Computadora',type:'computer'};
}
export function deviceType(type, label = '') {
  if (['tablet','phone','computer'].includes(type)) return type;
  if (/iPad|tablet/i.test(label)) return 'tablet';
  if (/iPhone|iPod|Android|tel[eé]fono|m[oó]vil|celular/i.test(label)) return 'phone';
  if (/Windows|laptop|computadora|Mac|Linux|\bPC\b/i.test(label)) return 'computer';
  return 'unknown';
}
const icons = {
  tablet:'<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 19h2"/>',
  phone:'<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M10 5h4M11 19h2"/>',
  computer:'<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M8 21h8M12 16v5"/>',
  unknown:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M10 17h4"/>',
};
export function deviceIcon(type) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[type] || icons.unknown}</svg>`;
}
