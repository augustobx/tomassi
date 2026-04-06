import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import {
  LogOut, LayoutDashboard, ShoppingCart, Package,
  History, Users, Settings, BarChart4, Store, Wallet, ShieldCheck,
  Building2, Tag, Contact, ClipboardList, Replace, HardDrive
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

// METADATA ACTUALIZADA PARA PWA
export const metadata: Metadata = {
  title: "SellPoint",
  description: "Sistema de Gestión y Facturación",
  manifest: "/manifest.json",
};

// VIEWPORT SEPARADO (Requerido en Next 14+)
export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {

  // 1. EL LAYOUT LEE LA SESIÓN DEL USUARIO
  const cookieStore = await cookies();
  const token = cookieStore.get('tendeco_session')?.value;

  let esAdmin = false;
  let esVendedor = false;
  let permisos: string[] = [];
  let isLogueado = false;
  let nombreUsuario = "";
  let rolUsuario = "";

  if (token) {
    try {
      const secretKey = process.env.SESSION_SECRET || 'tendeco-super-secret-key-2024';
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secretKey));
      esAdmin = payload.rol === 'ADMIN';
      esVendedor = payload.rol === 'VENDEDOR';
      rolUsuario = payload.rol as string;
      permisos = (payload.permisos as string[]) || [];
      nombreUsuario = payload.nombre as string;
      isLogueado = true;
    } catch (error) {
      isLogueado = false; // El token expiró o es inválido
    }
  }

  return (
    <html lang="es">
      <body className={`${inter.className} bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-50`}>

        {!isLogueado ? (
          // =========================================================
          // VISTA SIN SESIÓN (Login / Tickets de Impresión)
          // =========================================================
          <main className="w-full min-h-screen">
            {children}
          </main>
        ) : esVendedor ? (
          // =========================================================
          // VISTA VENDEDOR PWA (Sin Sidebar — Solo la PWA)
          // =========================================================
          <main className="w-full min-h-screen">
            {children}
          </main>
        ) : (

          // =========================================================
          // VISTA CON SESIÓN (ERP Principal)
          // =========================================================
          <div className="flex h-screen overflow-hidden print:h-auto print:block print:overflow-visible">

            {/* SIDEBAR CORPORATIVO */}
            <aside className="w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 flex-col hidden md:flex shrink-0 print:hidden">

              {/* BRANDING */}
              <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                <Store className="h-6 w-6 text-indigo-600 mr-2" />
                <span className="font-black text-xl tracking-tight text-slate-900 dark:text-white">Tommasi</span>
              </div>

              {/* INFO DEL USUARIO */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 shrink-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Operador Activo</p>
                <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate">{nombreUsuario}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${esAdmin ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${esAdmin ? 'text-indigo-600' : 'text-slate-600'}`}>
                    {esAdmin ? 'Dueño (Admin)' : rolUsuario === 'VENDEDOR' ? 'Vendedor' : 'Cajero'}
                  </span>
                </div>
              </div>

              {/* NAVEGACIÓN CATEGORIZADA */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-6 hide-scrollbar">

                {/* BLOQUE 1: INICIO */}
                <div className="space-y-1">
                  <Link href="/" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                    <LayoutDashboard className="h-4 w-4 opacity-70" /> Panel Principal
                  </Link>
                </div>

                {/* BLOQUE 2: OPERACIONES DIARIAS */}
                {(esAdmin || permisos.includes("VENTAS") || permisos.includes("CAJA") || permisos.includes("HISTORIAL")) && (
                  <div className="space-y-1">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Operaciones</p>

                    {(esAdmin || permisos.includes("VENTAS")) && (
                      <Link href="/ventas" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                        <ShoppingCart className="h-4 w-4 opacity-70" /> Punto de Venta
                      </Link>
                    )}
                    {(esAdmin || permisos.includes("VENTAS")) && (
                      <Link href="/pedidos" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                        <ClipboardList className="h-4 w-4 opacity-70" /> Pedidos Vendedores
                      </Link>
                    )}
                    {(esAdmin || permisos.includes("CAJA")) && (
                      <Link href="/caja" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                        <Wallet className="h-4 w-4 opacity-70" /> Caja Diaria
                      </Link>
                    )}
                    {(esAdmin || permisos.includes("HISTORIAL")) && (
                      <Link href="/historial" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                        <History className="h-4 w-4 opacity-70" /> Historial de Ventas
                      </Link>
                    )}
                    {(esAdmin || permisos.includes("PRESUPUESTOS")) && (
                      <Link href="/presupuestos" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors">
                        <ClipboardList className="h-4 w-4 opacity-70" /> Presupuestos
                      </Link>
                    )}
                  </div>
                )}

                {/* BLOQUE 3: GESTIÓN COMERCIAL */}
                {(esAdmin || permisos.includes("INVENTARIO") || permisos.includes("CLIENTES")) && (
                  <div className="space-y-1">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gestión Comercial</p>

                    {(esAdmin || permisos.includes("INVENTARIO")) && (
                      <>
                        <Link href="/inventario" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                          <Package className="h-4 w-4 opacity-70" /> Productos y Stock
                        </Link>
                        <Link href="/transferencias" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                          <Replace className="h-4 w-4 opacity-70" /> Movimientos y Transf.
                        </Link>
                        <Link href="/listas-precio" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                          <Tag className="h-4 w-4 opacity-70" /> Listas de Precios
                        </Link>
                        <Link href="/proveedores" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                          <Building2 className="h-4 w-4 opacity-70" /> Marcas y Proveedores
                        </Link>
                      </>
                    )}

                    {(esAdmin || permisos.includes("CLIENTES")) && (
                      <>
                        <Link href="/clientes" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                          <Contact className="h-4 w-4 opacity-70" /> Directorio de Clientes
                        </Link>
                        <Link href="/cuentas-corrientes" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                          <Users className="h-4 w-4 opacity-70" /> Cuentas Corrientes
                        </Link>
                      </>
                    )}
                  </div>
                )}

                {/* BLOQUE 4: GERENCIA Y SISTEMA */}
                {(esAdmin || permisos.includes("REPORTES") || permisos.includes("CONFIGURACION")) && (
                  <div className="space-y-1">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gerencia</p>

                    {(esAdmin || permisos.includes("REPORTES")) && (
                      <Link href="/reportes" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                        <BarChart4 className="h-4 w-4 opacity-70" /> Reportes Maestros
                      </Link>
                    )}
                    {esAdmin && (
                      <Link href="/importar" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                        <HardDrive className="h-4 w-4 opacity-70" /> Importar Excel
                      </Link>
                    )}
                    {esAdmin && (
                      <Link href="/usuarios" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                        <ShieldCheck className="h-4 w-4 opacity-70" /> Control de Accesos
                      </Link>
                    )}
                    {esAdmin && (
                      <Link href="/configuracion" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                        <Settings className="h-4 w-4 opacity-70" /> Empresa (General)
                      </Link>
                    )}
                    {esAdmin && (
                      <Link href="/configuracion/sucursales" className="flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors">
                        <Store className="h-4 w-4 opacity-70" /> Sucursales y Depósitos
                      </Link>
                    )}
                  </div>
                )}
              </nav>

              {/* BOTÓN CERRAR SESIÓN */}
              <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 shrink-0">
                <form action={logout}>
                  <button type="submit" className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-sm font-bold text-red-600 bg-white border border-red-100 hover:bg-red-50 hover:border-red-200 dark:bg-zinc-900 dark:border-red-900 dark:hover:bg-red-950 rounded-xl transition-all shadow-sm">
                    <LogOut className="h-4 w-4" /> Cerrar Sesión
                  </button>
                </form>
              </div>
            </aside>

            {/* ÁREA DE CONTENIDO PRINCIPAL */}
            <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50 dark:bg-zinc-950 print:overflow-visible print:p-0 print:bg-white">
              {children}
            </main>
          </div>
        )}

        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}