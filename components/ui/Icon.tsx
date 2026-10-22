/**
 * RestoBoard icon set: drawn on a 24px grid, 1.5px stroke, square caps.
 * Same geometry as the Figma "Icon/*" components. Color follows currentColor.
 */
const paths = {
  dashboard: '<rect x="3.75" y="3.75" width="7" height="7"/><rect x="13.25" y="3.75" width="7" height="7"/><rect x="3.75" y="13.25" width="7" height="7"/><rect x="13.25" y="13.25" width="7" height="7"/>',
  orders: '<path d="M5.75 3.75h12.5v16.5l-2.5-1.5-2.5 1.5-2.5-1.5-2.5 1.5-2.5-1.5z"/><path d="M9 8.5h6M9 12h6M9 15.5h3.5"/>',
  reservations: '<rect x="3.75" y="5.25" width="16.5" height="15"/><path d="M3.75 9.75h16.5M8 3v4M16 3v4M8 13.5h2M14 13.5h2M8 17h2"/>',
  kitchen: '<path d="M12 3.75c3 3 5.25 5.6 5.25 9.25a5.25 5.25 0 0 1-10.5 0c0-2 1-3.5 2.25-4.5.2 1.7 1 2.75 2 3.25-.5-2.6.1-5.5 1-8z"/>',
  floor: '<rect x="3.75" y="3.75" width="16.5" height="16.5"/><circle cx="9" cy="9" r="2"/><circle cx="15" cy="15" r="2"/><rect x="13" y="7" width="4" height="4"/><rect x="7" y="13" width="4" height="4"/>',
  stock: '<path d="M3.75 7.5 12 3.75l8.25 3.75v9L12 20.25 3.75 16.5z"/><path d="M3.75 7.5 12 11.25l8.25-3.75M12 11.25v9"/>',
  staff: '<circle cx="9" cy="8.25" r="3.25"/><path d="M3.25 19.5c.6-3.2 2.8-5 5.75-5s5.15 1.8 5.75 5M15.5 5.2a3.25 3.25 0 0 1 0 6.1M17.5 14.8c1.7.6 2.9 2.2 3.25 4.7"/>',
  menu: '<path d="M7 3v7.5M4.75 3v4.75a2.25 2.25 0 0 0 4.5 0V3M7 10.5V21M17.25 21V3c-2 1-3.5 3.5-3.5 7.25v3h3.5"/>',
  suppliers: '<path d="M3.75 6.75h10.5v9H3.75zM14.25 9.75h3.75l2.25 3v3h-6"/><circle cx="7.5" cy="17.25" r="1.5"/><circle cx="17.25" cy="17.25" r="1.5"/>',
  reports: '<path d="M3.75 20.25h16.5M6.75 17.25v-6M11.25 17.25V6.75M15.75 17.25v-9"/>',
  settings: '<path d="M3.75 7h9M16.75 7h3.5M3.75 17h3.5M11.25 17h9"/><rect x="12.75" y="5" width="4" height="4"/><rect x="7.25" y="15" width="4" height="4"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z"/><path d="M10 20.5h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.25"/><path d="m15 15 5.25 5.25"/>',
  plus: '<path d="M12 4.5v15M4.5 12h15"/>',
  download: '<path d="M12 3.75v11M7.5 10.5 12 15l4.5-4.5M4.5 20.25h15"/>',
  clock: '<circle cx="12" cy="12" r="8.25"/><path d="M12 7.5V12l3 2"/>',
  "chevron-down": '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  "chevron-left": '<path d="m14.5 6.5-5.5 5.5 5.5 5.5"/>',
  more: '<rect x="4" y="11" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="10.75" y="11" width="2.5" height="2.5" fill="currentColor" stroke="none"/><rect x="17.5" y="11" width="2.5" height="2.5" fill="currentColor" stroke="none"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  "arrow-up-right": '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
  "arrow-down-right": '<path d="M7 7l10 10M17 8.5V17H8.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<path d="M12 4 20.75 19.5H3.25z"/><path d="M12 10v4M12 16.5v.75"/>',
  "sidebar-collapse": '<rect x="3.75" y="3.75" width="16.5" height="16.5"/><path d="M9.75 3.75v16.5M16 9l-3 3 3 3"/>',
  hamburger: '<path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"/>',
  info: '<circle cx="12" cy="12" r="8.25"/><path d="M12 11v5.5M12 7.5v.75"/>',
  "check-circle": '<circle cx="12" cy="12" r="8.25"/><path d="m8.25 12.25 2.5 2.5 5-5"/>',
  filter: '<path d="M3.75 5.25h16.5l-6.5 7.5v6l-3.5 1.5v-7.5z"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.25h-4.25"/>',
  upload: '<path d="M12 20.25V8.25M7.5 12.75 12 8.25l4.5 4.5M4.5 3.75h15"/>',
  edit: '<path d="M4.5 19.5h4L18.75 9.25a2.12 2.12 0 0 0-3-3L5.5 16.5z"/><path d="M13.5 6.75l3 3"/>',
  power: '<path d="M12 3.75v7.5"/><path d="M7.05 6.55a7.5 7.5 0 1 0 9.9 0"/>',
  trash: '<path d="M4.5 6.75h15M9.75 6.75V4.5h4.5v2.25M6.75 6.75l.9 12.75h8.7l.9-12.75M10.5 10.5v6M13.5 10.5v6"/>',
  paperclip: '<path d="M20.25 11.25 12 19.5a5.3 5.3 0 0 1-7.5-7.5l8.25-8.25a3.5 3.5 0 0 1 4.95 4.95l-8.25 8.25a1.77 1.77 0 0 1-2.5-2.5l7.5-7.5"/>',
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
      className={className}
      // Static, trusted markup defined above.
      dangerouslySetInnerHTML={{ __html: paths[name] }}
    />
  );
}
