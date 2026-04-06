"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  ColumnDef, ColumnFiltersState, SortingState, VisibilityState,
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable,
} from "@tanstack/react-table";
import {
  AlertTriangle, ArrowUpDown, ChevronDown, MoreHorizontal, Pencil, Search,
  Zap, X, Loader2, ArrowUpRight, History, TrendingUp, PackagePlus,
  ArrowRightLeft, Plus
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuGroup,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import {
  formatCurrency, calcularPrecioConCascada,
  formatCantidad, getUnidadLabel, getStepParaMedicion,
  type TipoMedicionType,
} from "@/lib/utils";
import { actualizarStockRapido, getHistorialProducto } from "@/app/actions/productos";

export type ProductoColumn = {
  id: number;
  codigo_articulo: string;
  codigo_barras: string;
  fecha_ingreso: Date;
  nombre_producto: string;
  categoria: string;
  proveedor: string;
  marca: string;
  stock_actual: number;
  stocks?: any[];
  stock_recomendado: number;
  tipo_medicion: string;
  moneda: "ARS" | "USD";
  precio_costo: number;
  alicuota_iva: number;
  descuento_proveedor: number;
  aumento_proveedor: number;
  aumento_marca: number;
  aumento_categoria: number;
  listas_precios: any[];
  updatedAt: Date;
};

export const getColumns = (
  listasGlobales: any[],
  handleAbrirEdicion: (prod: any) => void,
  handleAbrirHistorial: (prod: any) => void
): ColumnDef<ProductoColumn>[] => {
  const baseColumns: ColumnDef<ProductoColumn>[] = [
    {
      accessorKey: "codigo_articulo",
      header: "Cód. Artículo",
      cell: ({ row }) => <div className="font-mono text-slate-500 text-xs">{row.getValue("codigo_articulo")}</div>,
    },
    {
      accessorKey: "codigo_barras",
      header: "Cód. Barras",
      cell: ({ row }) => <div className="font-mono text-slate-400 text-xs">{row.getValue("codigo_barras")}</div>,
    },
    {
      accessorKey: "nombre_producto",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="text-slate-500 hover:text-slate-900 font-bold px-0 bg-transparent hover:bg-transparent">
          Producto <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <div className="font-bold text-slate-900 dark:text-white text-sm">{row.getValue("nombre_producto")}</div>,
    },
    {
      accessorKey: "proveedor",
      header: "Proveedor",
      cell: ({ row }) => <div className="text-slate-600 text-sm">{row.getValue("proveedor")}</div>,
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "tipo_medicion",
      header: "Unidad",
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "stock_actual",
      header: () => <div className="text-right">Stock Gral.</div>,
      cell: ({ row }) => {
        const stock = Number(row.getValue("stock_actual"));
        const stocksArray = row.original.stocks || [];
        const recomendado = row.original.stock_recomendado;
        const isLowStock = stock <= recomendado;
        const isZero = stock <= 0;
        const tipo = (row.original.tipo_medicion || "UNIDAD") as TipoMedicionType;
        const label = getUnidadLabel(tipo);
        const formatted = formatCantidad(stock, tipo);

        return (
          <div className="flex flex-col items-end gap-1">
            <div className="flex justify-end items-center gap-2">
              {isZero && <span title="Sin stock global"><AlertTriangle className="h-4 w-4 text-red-600 fill-red-100" /></span>}
              {!isZero && isLowStock && <span title="Stock global bajo"><AlertTriangle className="h-4 w-4 text-orange-500" /></span>}
              <Badge variant="outline" className={`font-mono font-bold text-sm ${isZero ? 'bg-red-100 text-red-700 border-red-300' : isLowStock ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {formatted} {label}
              </Badge>
            </div>
            {stocksArray.length > 0 && (
              <div className="flex flex-col items-end gap-0.5 mt-1">
                {stocksArray.map((s: any) => (
                  <span key={s.depositoId} className="text-[10px] text-slate-500 font-medium">
                    {s.deposito?.sucursal?.nombre ? `${s.deposito.sucursal.nombre} (${s.deposito.nombre})` : s.deposito?.nombre}: <span className="font-bold">{formatCantidad(s.cantidad, tipo)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "precio_costo",
      header: () => <div className="text-right">Costo Base</div>,
      cell: ({ row }) => {
        const monto = parseFloat(row.getValue("precio_costo"));
        const moneda = row.original.moneda;
        return <div className="text-right font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(monto, moneda)}</div>;
      },
    },
  ];

  const listasColumns: ColumnDef<ProductoColumn>[] = listasGlobales.map(lista => ({
    id: `lista_${lista.id}`,
    header: () => <div className="text-right text-[10px] uppercase font-bold text-slate-400 whitespace-nowrap">P. {lista.nombre}</div>,
    cell: ({ row }) => {
      const pivot = row.original.listas_precios?.find(lp => lp.listaPrecioId === lista.id);
      if (!pivot) return <div className="text-right text-slate-300">-</div>;

      const margenFinal = pivot.margen_personalizado ?? lista.margen_defecto;
      const precioFinal = calcularPrecioConCascada(
        row.original.precio_costo,
        row.original.descuento_proveedor || 0,
        row.original.alicuota_iva || 21,
        row.original.aumento_proveedor || 0,
        row.original.aumento_marca || 0,
        row.original.aumento_categoria || 0,
        margenFinal
      );

      return <div className="text-right font-bold whitespace-nowrap text-slate-700 dark:text-slate-300">{formatCurrency(precioFinal, row.original.moneda)}</div>;
    }
  }));

  const actionsColumn: ColumnDef<ProductoColumn> = {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const producto = row.original;
      return (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" onClick={() => handleAbrirEdicion(producto)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-8 shadow-sm">
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Stock/Precio
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: "ghost", className: "h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100" })}>
              <span className="sr-only">Menú</span>
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-slate-400 uppercase tracking-wider font-bold">Acciones</DropdownMenuLabel>
                <DropdownMenuItem className="p-0 cursor-pointer mb-1">
                  <button onClick={() => handleAbrirHistorial(producto)} className="flex items-center w-full px-2 py-1.5 text-indigo-600 font-semibold hover:bg-indigo-50 rounded-sm transition-colors">
                    <History className="mr-2 h-4 w-4" /> Ver Historial
                  </button>
                </DropdownMenuItem>
                <DropdownMenuItem className="p-0 cursor-pointer">
                  <Link href={`/inventario/${producto.id}/editar`} className="flex items-center w-full px-2 py-1.5 text-slate-700 hover:bg-slate-100 font-medium rounded-sm transition-colors">
                    <Pencil className="mr-2 h-4 w-4 text-slate-400" /> Edición Completa
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(producto.codigo_barras)} className="text-slate-600 font-medium cursor-pointer hover:bg-slate-100">
                Copiar Cód. Barras
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  };

  return [...baseColumns, ...listasColumns, actionsColumn];
};

interface StockTableProps {
  data: ProductoColumn[];
  proveedores: string[];
  listasGlobales: any[];
  depositos: any[];
  usuarioId?: number;
}

export function StockTable({ data, proveedores, listasGlobales, depositos, usuarioId }: StockTableProps) {
  const [isPending, startTransition] = useTransition();

  const [productoEditando, setProductoEditando] = useState<any | null>(null);
  const [formRapido, setFormRapido] = useState({ cantidad_sumar: 0, stock_recomendado: 0, precio_costo: 0, depositoId: "" });

  const [productoHistorial, setProductoHistorial] = useState<any | null>(null);
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const handleAbrirEdicion = (prod: any) => {
    setFormRapido({ 
      cantidad_sumar: 0, 
      stock_recomendado: prod.stock_recomendado, 
      precio_costo: prod.precio_costo, 
      depositoId: depositos.length > 0 ? String(depositos[0].id) : ""
    });
    setProductoEditando(prod);
  };

  const handleGuardarRapido = () => {
    if (formRapido.precio_costo <= 0) return toast.error("El precio debe ser mayor a 0.");
    if (formRapido.cantidad_sumar !== 0 && !formRapido.depositoId) return toast.error("Debe seleccionar un depósito para ingresar/retirar stock.");
    
    startTransition(async () => {
      const depId = formRapido.depositoId ? Number(formRapido.depositoId) : 0;
      const res = await actualizarStockRapido(productoEditando.id, Number(formRapido.cantidad_sumar), Number(formRapido.stock_recomendado), Number(formRapido.precio_costo), depId, usuarioId);
      if (res.success) {
        toast.success("¡Producto actualizado!", { description: "Impactado en todas las listas e historial." });
        setProductoEditando(null);
      } else { toast.error(res.error); }
    });
  };

  const handleAbrirHistorial = async (prod: any) => {
    setProductoHistorial(prod);
    setLoadingHistorial(true);
    const res = await getHistorialProducto(prod.id);
    if (res.success && res.data) setHistorialData(res.data);
    else toast.error("Error al cargar el historial");
    setLoadingHistorial(false);
  };

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({ codigo_barras: false, tipo_medicion: false });
  const [globalFilter, setGlobalFilter] = React.useState("");

  // Refactor column filters to properly isolate "proveedor"
  const handleProveedorFilter = (value: string) => {
    if (value === "ALL") {
      setColumnFilters(filters => filters.filter(f => f.id !== "proveedor"));
    } else {
      setColumnFilters(filters => {
        const without = filters.filter(f => f.id !== "proveedor");
        return [...without, { id: "proveedor", value }];
      });
    }
  };

  const columns = React.useMemo(() => getColumns(listasGlobales, handleAbrirEdicion, handleAbrirHistorial), [listasGlobales]);

  const table = useReactTable({
    data, columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: "includesString",
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  const tipoMedicionActual = productoEditando ? (productoEditando.tipo_medicion as TipoMedicionType) : "UNIDAD";
  const stepStock = getStepParaMedicion(tipoMedicionActual);

  return (
    <div className="w-full space-y-4 relative">
      {/* BARRA DE HERRAMIENTAS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto flex-1">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar por código, barra o nombre..." value={globalFilter ?? ""} onChange={(e) => setGlobalFilter(String(e.target.value))}
              className="pl-10 h-10 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-sm" />
          </div>
          <div className="w-full sm:w-48">
            <select
              className="w-full h-10 border border-slate-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 px-3 text-sm text-slate-600 dark:text-slate-300 shadow-sm"
              onChange={(e) => handleProveedorFilter(e.target.value)}
              defaultValue="ALL"
            >
              <option value="ALL">Todos los Proveedores</option>
              {proveedores.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: "outline", className: "h-10 bg-white border-slate-200 text-slate-600 font-medium" })}>
              Columnas <ChevronDown className="ml-2 h-4 w-4 text-slate-400" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border-slate-200">
              {table.getAllColumns().filter(c => c.getCanHide()).map(column => (
                <DropdownMenuCheckboxItem key={column.id} className="capitalize font-medium text-slate-600" checked={column.getIsVisible()} onCheckedChange={(value) => column.toggleVisibility(!!value)}>
                  {column.id.replace(/_/g, " ")}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/inventario/nuevo">
            <Button className="h-10 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> Nuevo Producto
            </Button>
          </Link>
        </div>
      </div>

      {/* TABLA */}
      <Card className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800">
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id} className="hover:bg-transparent border-none">
                  {hg.headers.map(header => (
                    <TableHead key={header.id} className="text-[10px] uppercase font-bold text-slate-500 tracking-wider h-11">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800">
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}
                    className={row.original.stock_actual <= 0
                      ? "bg-red-50/70 hover:bg-red-50 dark:bg-red-900/15 transition-colors"
                      : row.original.stock_actual <= row.original.stock_recomendado
                        ? "bg-orange-50/50 hover:bg-orange-50 dark:bg-orange-900/10 transition-colors"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-slate-400">No se encontraron resultados.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* PAGINACIÓN */}
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">
          Mostrando <span className="text-slate-900">{table.getRowModel().rows.length}</span> de {table.getFilteredRowModel().rows.length} productos
        </div>
        <div className="space-x-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="bg-white border-slate-200 text-slate-600 font-medium">Anterior</Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="bg-white border-slate-200 text-slate-600 font-medium">Siguiente</Button>
        </div>
      </div>

      {/* MODAL EDICIÓN RÁPIDA */}
      {productoEditando && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-sm shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col rounded-2xl">
            <CardHeader className="bg-slate-50/50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800 p-4 shrink-0 flex flex-row justify-between items-center rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-50 text-indigo-600 p-2 rounded-lg"><Zap className="h-4 w-4 fill-indigo-600/20" /></div>
                <div>
                  <CardTitle className="text-base text-slate-900">Ajuste Rápido</CardTitle>
                  <CardDescription className="text-xs text-slate-500 truncate max-w-[200px]" title={productoEditando.nombre_producto}>{productoEditando.nombre_producto}</CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setProductoEditando(null)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200"><X className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="flex justify-between bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-slate-100 dark:border-zinc-700">
                <div><p className="text-[10px] uppercase font-bold text-slate-500">Último Costo</p><p className="text-sm font-black text-slate-900">${productoEditando.precio_costo.toFixed(2)}</p></div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Unidad</p>
                  <p className="text-sm font-bold text-slate-700">{getUnidadLabel(tipoMedicionActual)}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <div className="w-1/3 space-y-1.5">
                    <Label className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">Stock Global</Label>
                    <div className="h-10 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-center text-base font-black text-slate-400 cursor-not-allowed">
                      {formatCantidad(productoEditando.stock_actual, tipoMedicionActual)}
                    </div>
                  </div>
                  <div className="w-1/3 space-y-1.5">
                    <Label className="font-bold text-[10px] uppercase text-emerald-600 tracking-wider">Ajuste (+/-)</Label>
                    <Input type="number" step={stepStock} value={formRapido.cantidad_sumar} onChange={(e) => setFormRapido({ ...formRapido, cantidad_sumar: Number(e.target.value) })}
                      className="h-10 text-lg font-black text-center border-emerald-200 bg-emerald-50 text-emerald-700 focus-visible:ring-emerald-500" />
                  </div>
                  <div className="w-1/3 space-y-1.5">
                    <Label className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">Mínimo global</Label>
                    <Input type="number" step={stepStock} value={formRapido.stock_recomendado} onChange={(e) => setFormRapido({ ...formRapido, stock_recomendado: Number(e.target.value) })}
                      className="h-10 text-sm font-bold text-center bg-slate-50 border-slate-200" />
                  </div>
                </div>
                
                {formRapido.cantidad_sumar !== 0 && (
                  <div className="space-y-1.5 animate-in fade-in duration-200">
                    <Label className="font-bold text-[10px] uppercase text-slate-500 tracking-wider">Depósito Destino/Origen</Label>
                    <select
                      className="w-full h-10 border border-slate-200 rounded-lg bg-white px-3 text-sm"
                      value={formRapido.depositoId}
                      onChange={(e) => setFormRapido({ ...formRapido, depositoId: e.target.value })}
                    >
                      {depositos.map(d => (
                        <option key={d.id} value={d.id}>{d.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2 p-4 bg-indigo-50/50 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20 rounded-xl">
                <Label className="font-bold text-[11px] uppercase text-indigo-600 tracking-wider flex items-center gap-1">
                  Nuevo Costo Base <ArrowUpRight className="h-3 w-3" />
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-indigo-400 font-bold">$</span>
                  <Input type="number" autoFocus value={formRapido.precio_costo} onChange={(e) => setFormRapido({ ...formRapido, precio_costo: Number(e.target.value) })}
                    className="h-11 pl-8 text-lg font-black text-indigo-700 bg-white border-indigo-200 focus-visible:ring-indigo-500" />
                </div>
                <p className="text-[10px] text-indigo-600/70 font-medium leading-tight">Actualizará automáticamente todas las listas de mostrador.</p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <Button variant="ghost" onClick={() => setProductoEditando(null)} className="w-1/3 text-slate-600">Cancelar</Button>
                <Button onClick={handleGuardarRapido} disabled={isPending} className="w-2/3 bg-indigo-600 hover:bg-indigo-700 font-bold text-white shadow-sm">
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar Ajuste"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL HISTORIAL */}
      {productoHistorial && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] border border-slate-200 rounded-2xl">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-5 shrink-0 flex flex-row justify-between items-center rounded-t-2xl">
              <div>
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900"><History className="text-indigo-600 h-5 w-5" /> Auditoría de Producto</CardTitle>
                <CardDescription className="text-xs mt-1">Métricas de <span className="font-bold text-slate-700">{productoHistorial.nombre_producto}</span></CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setProductoHistorial(null)} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-200"><X className="h-5 w-5" /></Button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto flex-1 bg-white">
              {loadingHistorial ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-indigo-500" /></div>
              ) : historialData.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">Aún no hay modificaciones registradas.</p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
                  {historialData.map((item) => {
                    const esIngreso = item.tipo_registro === "INGRESO_STOCK";
                    const esPrecio = item.tipo_registro === "CAMBIO_PRECIO";
                    const esAmbos = item.tipo_registro === "AMBOS";

                    return (
                      <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white text-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${esPrecio ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                          {esIngreso && <PackagePlus className="h-4 w-4" />}
                          {esPrecio && <TrendingUp className="h-4 w-4" />}
                          {esAmbos && <ArrowRightLeft className="h-4 w-4" />}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border border-slate-100 bg-white shadow-sm">
                          <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                            <div>
                              <p className="font-bold text-sm uppercase text-slate-800 tracking-tight">
                                {esIngreso ? "Ingreso de Mercadería" : esPrecio ? "Actualización de Precio" : "Ajuste General"}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <time className="font-mono text-[11px] text-slate-400 block">{new Date(item.fecha).toLocaleString('es-AR')}</time>
                                {item.usuario?.nombre && (
                                  <Badge variant="outline" className="text-[9px] text-slate-500 bg-slate-50">{item.usuario.nombre}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            {(esIngreso || esAmbos) && (
                              <div className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stock:</span>
                                <div className="text-right flex items-center gap-2">
                                  <span className="text-xs text-slate-400 line-through">{item.stock_anterior}</span>
                                  <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                                  <span className="font-black text-emerald-600">{item.stock_nuevo}</span>
                                  <Badge variant="outline" className="ml-1 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">+{item.cantidad_agregada}</Badge>
                                </div>
                              </div>
                            )}
                            {(esPrecio || esAmbos) && (
                              <div className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-lg">
                                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Precio Costo:</span>
                                <div className="text-right flex items-center gap-2">
                                  <span className="text-xs text-slate-400 line-through">${item.precio_anterior.toFixed(2)}</span>
                                  <ArrowUpRight className="h-3 w-3 text-indigo-600" />
                                  <span className="font-black text-indigo-700">${item.precio_nuevo.toFixed(2)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}