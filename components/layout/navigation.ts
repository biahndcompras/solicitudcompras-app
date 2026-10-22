import type { IconName } from "../ui/Icon";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
};

export type NavGroup = { label: string; items: NavItem[] };

/** Portal del admin: gestión + configuración. */
export const ADMIN_PORTAL = { label: "Administración", sub: "Trazabilidad" };

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Gestión",
    items: [
      { href: "/admin", label: "Dashboard", icon: "dashboard" },
      { href: "/admin/procesos", label: "Procesos", icon: "orders" },
      { href: "/admin/coordinadores", label: "Coordinadores", icon: "staff" },
    ],
  },
  {
    label: "Configuración",
    items: [
      { href: "/admin/campos", label: "Campos", icon: "menu" },
      { href: "/admin/configuracion", label: "Umbrales y alertas", icon: "settings" },
    ],
  },
];

export const COORDINATOR_PORTAL = { label: "Compras", sub: "Coordinación" };

/**
 * Navegación del coordinador: el flujo, no un menú genérico. Cada etapa es una
 * bandeja propia con su contador, para que se vea de un vistazo qué requiere
 * acción (cotizar, enviar comparativa) y qué solo espera (decisión).
 */
export function coordinatorNav(c: {
  todas: number;
  porCotizar: number;
  comparativas: number;
  esperando: number;
  cerradas: number;
}): NavGroup[] {
  return [
    {
      label: "Bandeja",
      items: [{ href: "/panel", label: "Todas", icon: "dashboard", count: c.todas }],
    },
    {
      label: "Flujo",
      items: [
        { href: "/panel/cotizaciones", label: "Por cotizar", icon: "orders", count: c.porCotizar },
        { href: "/panel/comparativas", label: "Comparativas", icon: "reports", count: c.comparativas },
        { href: "/panel/decisiones", label: "Esperando", icon: "clock", count: c.esperando },
      ],
    },
    {
      label: "Archivo",
      items: [{ href: "/panel/cerradas", label: "Cerradas", icon: "check-circle", count: c.cerradas }],
    },
  ];
}
