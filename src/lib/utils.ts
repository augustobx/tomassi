import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ==========================================
// CÁLCULOS DE PRECIO BASE
// ==========================================

export function calcularCostoNeto(precioCosto: number, descuentoProveedor: number) {
  return precioCosto - (precioCosto * descuentoProveedor) / 100;
}

export function calcularCostoIva(costoNeto: number, alicuotaIva: number) {
  return costoNeto * (1 + alicuotaIva / 100);
}

export function calcularPrecioFinal(costoIva: number, porcentajeMarcacion: number) {
  return costoIva * (1 + porcentajeMarcacion / 100);
}

// ==========================================
// CÁLCULO CON CASCADA P → M → C
// ==========================================

/**
 * Calcula el precio final aplicando la cascada:
 * 1. Costo Neto = precioCosto * (1 - descProv/100)
 * 2. Costo + IVA
 * 3. + Aumento Proveedor %
 * 4. + Aumento Marca %
 * 5. + Aumento Categoría %
 * 6. + Margen Lista de Precios %
 */
export function calcularPrecioConCascada(
  precioCosto: number,
  descuentoProveedor: number,
  alicuotaIva: number,
  aumentoProveedor: number,
  aumentoMarca: number,
  aumentoCategoria: number,
  margenLista: number
): number {
  const costoNeto = calcularCostoNeto(precioCosto, descuentoProveedor);
  const costoIva = calcularCostoIva(costoNeto, alicuotaIva);
  const conAumProv = costoIva * (1 + (aumentoProveedor || 0) / 100);
  const conAumMarca = conAumProv * (1 + (aumentoMarca || 0) / 100);
  const conAumCat = conAumMarca * (1 + (aumentoCategoria || 0) / 100);
  const precioFinal = conAumCat * (1 + (margenLista || 0) / 100);
  return precioFinal;
}

// ==========================================
// HELPERS DE UNIDADES DE MEDIDA
// ==========================================

export type TipoMedicionType = "UNIDAD" | "KILO" | "LITRO" | "METROS" | "CAJA" | "PACK";

const UNIDAD_LABELS: Record<TipoMedicionType, string> = {
  UNIDAD: "C/U",
  KILO: "KG",
  LITRO: "LTS",
  METROS: "MTS",
  CAJA: "CAJA",
  PACK: "PACK",
};

const UNIDAD_FULL_LABELS: Record<TipoMedicionType, string> = {
  UNIDAD: "Unidades (C/U)",
  KILO: "Kilogramos (KG)",
  LITRO: "Litros (LTS)",
  METROS: "Metros (MTS)",
  CAJA: "Cajas",
  PACK: "Packs",
};

/** Devuelve el label corto: "KG", "LTS", "C/U", etc. */
export function getUnidadLabel(tipo: TipoMedicionType): string {
  return UNIDAD_LABELS[tipo] || tipo;
}

/** Devuelve el label completo: "Kilogramos (KG)", etc. */
export function getUnidadFullLabel(tipo: TipoMedicionType): string {
  return UNIDAD_FULL_LABELS[tipo] || tipo;
}

/** Devuelve el step del input numérico según la unidad */
export function getStepParaMedicion(tipo: TipoMedicionType): string {
  if (tipo === "UNIDAD" || tipo === "CAJA" || tipo === "PACK") return "1";
  return "0.01";
}

/** Devuelve si la unidad acepta decimales */
export function esUnidadDecimal(tipo: TipoMedicionType): boolean {
  return tipo === "KILO" || tipo === "LITRO" || tipo === "METROS";
}

/** Formatea la cantidad según la unidad: integer para unidades, 2 decimales para peso/volumen/longitud */
export function formatCantidad(cantidad: number, tipo: TipoMedicionType): string {
  if (esUnidadDecimal(tipo)) {
    return cantidad.toFixed(2);
  }
  return String(Math.round(cantidad));
}

/** Formatea stock con su unidad: "5 C/U", "2.50 KG", etc. */
export function formatStockConUnidad(stock: number, tipo: TipoMedicionType): string {
  return `${formatCantidad(stock, tipo)} ${getUnidadLabel(tipo)}`;
}

// ==========================================
// FORMATO DE MONEDA
// ==========================================

export function formatCurrency(value: number, currency: "ARS" | "USD" = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency,
  }).format(value);
}

// ==========================================
// FORMATO DE FECHA / HORA (es-AR)
// ==========================================

export function formatFechaLocal(date: string | Date | null | undefined): string {
    if (!date) return "";
    return new Date(date).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}

export function formatHoraLocal(date: string | Date | null | undefined): string {
    if (!date) return "";
    return new Date(date).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit' });
}

export function formatFechaHoraLocal(date: string | Date | null | undefined): string {
    if (!date) return "";
    return new Date(date).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
}
