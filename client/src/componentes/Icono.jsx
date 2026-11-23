// Responsable: Edwin Diaz
// Conjunto de íconos lineales (trazos del prototipo inicial)
const TRAZOS = {
  inicio: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  buscar: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  mensaje: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
  usuario: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  atras: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
  filtro: <path d="M4 6h16M7 12h10M10 18h4" />,
  cerrar: <path d="m6 6 12 12M18 6 6 18" />,
  flecha: <path d="M4 12h16m-6-6 6 6-6 6" />,
  mapa: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15M15 6v15" /></>,
  wifi: <><path d="M2 8.8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 15.5a5.5 5.5 0 0 1 7 0" /><circle cx="12" cy="19" r=".8" /></>,
  comida: <path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-4 2-5 6-5 10h5" />,
  lavanderia: <path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z" />,
  agua: <path d="M12 3S5 10 5 15a7 7 0 0 0 14 0c0-5-7-12-7-12Zm-3 12a3 3 0 0 0 3 3" />,
  energia: <path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z" />,
  cocina: <path d="M5 9h14v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V9ZM3 12h2m14 0h2M9 2v3m6-3v3M4 9h16" />,
  bano: <path d="M3 12h18v4a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-4Zm2 0V5a3 3 0 0 1 6 0M6 20v2m12-2v2" />,
  libro: <path d="M12 5C8 2 4 3 3 4v16c3-2 6-2 9 0 3-2 6-2 9 0V4c-3-2-6-2-9 1Zm0 0v15" />,
  foto: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1.5" /><path d="m3 17 5-5 4 4 4-6 5 7" /></>,
  mas: <path d="M12 5v14M5 12h14" />,
  edificio: <path d="M4 21V5h11v16M15 9h5v12M8 9h3M8 13h3M8 17h3" />,
  llave: <><circle cx="8" cy="15" r="4" /><path d="m11 12 8-8M15 8l3 3" /></>,
  lista: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  solicitudes: <><path d="M4 4h16v16H4z" /><path d="m8 12 3 3 5-6" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  editar: <><path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z" /><path d="m14 7 3 3" /></>,
  salir: <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />,
  ubicacion: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  escudo: <><path d="m12 3 8 4v6c0 5-8 9-8 9s-8-4-8-9V7Z" /><path d="m8 12 3 3 5-6" /></>,
  estrella: <path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1Z" />,
  calendario: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  grafica: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  corazon: <path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.8 4 7.3 4c2 0 3.6 1.1 4.7 2.7C13.1 5.1 14.7 4 16.7 4c3.5 0 5.7 3.3 4.5 6.7C19.5 15.4 12 20 12 20Z" />,
};

export default function Icono({ nombre, tam = 22 }) {
  return (
    <svg className="icono" width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {TRAZOS[nombre] || TRAZOS.inicio}
    </svg>
  );
}

// Ícono asociado a cada servicio de la pensión
const ICONO_SERVICIO = {
  Alimentación: 'comida', Lavandería: 'lavanderia', Internet: 'wifi', Agua: 'agua', Energía: 'energia',
  Cocina: 'cocina', 'Baño privado': 'bano', 'Espacio de estudio': 'libro', 'Servicios públicos': 'energia',
};
export const IconoServicio = ({ servicio, tam = 18 }) => <Icono nombre={ICONO_SERVICIO[servicio] || 'check'} tam={tam} />;
