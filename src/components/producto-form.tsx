"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { productoSchema } from "@/lib/validations";
import {
  calcularCostoNeto,
  calcularCostoIva,
  calcularPrecioConCascada,
  getStepParaMedicion,
  type TipoMedicionType,
} from "@/lib/utils";
import {
  crearProducto,
  actualizarProducto,
  checkCodigoUnico,
  getNextCodigoArticulo,
  crearProveedor,
  crearCategoria,
  crearMarca,
  getMarcasPorProveedor,
  getCategoriasPorMarca,
} from "@/app/actions/productos";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface Provider { id: number; nombre: string; aumento_porcentaje?: number; }
interface Marca { id: number; nombre: string; aumento_porcentaje?: number; proveedorId: number; }
interface Categoria { id: number; nombre: string; aumento_porcentaje?: number; marcaId?: number | null; }
interface ListaPrecioGlobal { id: number; nombre: string; margen_defecto: number; }

interface ProductoFormProps {
  initialData?: any;
  providers: Provider[];
  categorias: Categoria[];
  marcas?: Marca[];
  listasGlobales: ListaPrecioGlobal[];
  depositos?: any[];
}

export function ProductoForm({ initialData, providers: initialProviders, categorias: initialCategorias, marcas: initialMarcas, listasGlobales: initialListas, depositos: arrDepositos }: ProductoFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [providers, setProviders] = useState<Provider[]>(initialProviders);
  const [newProviderName, setNewProviderName] = useState("");
  const [isCreatingProvider, setIsCreatingProvider] = useState(false);

  const [marcas, setMarcas] = useState<Marca[]>(initialMarcas || []);
  const [newMarcaName, setNewMarcaName] = useState("");
  const [isCreatingMarca, setIsCreatingMarca] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>(initialCategorias);
  const [newCategoriaName, setNewCategoriaName] = useState("");
  const [isCreatingCategoria, setIsCreatingCategoria] = useState(false);

  const [codigoArticuloEstado, setCodigoArticuloEstado] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [codigoBarrasEstado, setCodigoBarrasEstado] = useState<"idle" | "checking" | "valid" | "invalid">("idle");

  const isEdit = !!initialData;

  const form = useForm<any>({
    resolver: zodResolver(productoSchema),
    defaultValues: initialData
      ? {
        ...initialData,
        fecha_ingreso: new Date(initialData.fecha_ingreso),
        stocks: initialData.stocks?.map((s: any) => ({
          depositoId: s.depositoId,
          cantidad: s.cantidad
        })) || [],
        listas_precios: initialListas.map(global => {
          const pivot = initialData.listas_precios?.find((p: any) => p.listaPrecioId === global.id);
          return {
            listaPrecioId: global.id,
            isActive: !!pivot,
            nombre_lista: global.nombre,
            margen_defecto: global.margen_defecto,
            margen_personalizado: pivot?.margen_personalizado ?? null,
          };
        })
      }
      : {
        codigo_articulo: "",
        codigo_barras: "0",
        fecha_ingreso: new Date(),
        nombre_producto: "",
        proveedorId: "",
        marcaId: "",
        categoriaId: "",
        alicuota_iva: 21,
        precio_costo: 0,
        descuento_proveedor: 0,
        stock_actual: 0,
        stock_recomendado: 0,
        tipo_medicion: "UNIDAD",
        moneda: "ARS",
        stocks: arrDepositos?.map(d => ({
          depositoId: d.id,
          cantidad: 0
        })) || [],
        listas_precios: initialListas.map(global => ({
          listaPrecioId: global.id,
          isActive: false,
          nombre_lista: global.nombre,
          margen_defecto: global.margen_defecto,
          margen_personalizado: null,
        })),
      },
  });

  const { control, handleSubmit, setValue, watch, register, formState: { errors } } = form;
  const { fields } = useFieldArray({ control, name: "listas_precios" });
  const { fields: stockFields } = useFieldArray({ control, name: "stocks" });

  const precioCosto = watch("precio_costo") || 0;
  const descuentoProveedor = watch("descuento_proveedor") || 0;
  const alicuotaIva = watch("alicuota_iva") || 21;
  const proveedorIdWatch = watch("proveedorId");
  const marcaIdWatch = watch("marcaId");
  const tipoMedicion = (watch("tipo_medicion") || "UNIDAD") as TipoMedicionType;

  const costoNetoVisual = calcularCostoNeto(Number(precioCosto), Number(descuentoProveedor));
  const costoIvaVisual = calcularCostoIva(costoNetoVisual, Number(alicuotaIva));

  // Cascading %
  const provSeleccionado = providers.find(p => String(p.id) === String(proveedorIdWatch));
  const marcaSeleccionada = marcas.find(m => String(m.id) === String(marcaIdWatch));
  const catIdWatch = watch("categoriaId");
  const catSeleccionada = categorias.find(c => String(c.id) === String(catIdWatch));
  const aumProv = provSeleccionado?.aumento_porcentaje || 0;
  const aumMarca = marcaSeleccionada?.aumento_porcentaje || 0;
  const aumCat = catSeleccionada?.aumento_porcentaje || 0;

  // Load marcas when proveedor changes
  useEffect(() => {
    if (proveedorIdWatch) {
      startTransition(async () => {
        const res = await getMarcasPorProveedor(Number(proveedorIdWatch));
        setMarcas(res);
      });
    } else {
      setMarcas([]);
    }
  }, [proveedorIdWatch]);

  // Load categorias when marca changes
  useEffect(() => {
    if (marcaIdWatch) {
      startTransition(async () => {
        const res = await getCategoriasPorMarca(Number(marcaIdWatch));
        setCategorias(res);
      });
    }
  }, [marcaIdWatch]);

  useEffect(() => {
    if (!isEdit) {
      startTransition(async () => {
        const nextCode = await getNextCodigoArticulo();
        setValue("codigo_articulo", nextCode, { shouldValidate: true });
        setCodigoArticuloEstado("valid");
      });
    }
  }, [isEdit, setValue]);

  const handleCheckUnique = async (campo: "codigo_articulo" | "codigo_barras", valor: string) => {
    if (!valor) return;
    if (campo === "codigo_barras" && valor === "0") return; // skip check for default
    if (campo === "codigo_articulo") setCodigoArticuloEstado("checking");
    if (campo === "codigo_barras") setCodigoBarrasEstado("checking");

    const isUnique = await checkCodigoUnico(campo, valor, initialData?.id);
    if (campo === "codigo_articulo") setCodigoArticuloEstado(isUnique ? "valid" : "invalid");
    if (campo === "codigo_barras") setCodigoBarrasEstado(isUnique ? "valid" : "invalid");

    if (!isUnique) {
      form.setError(campo, { type: "manual", message: "Este código ya está en uso." });
    } else {
      form.clearErrors(campo);
    }
  };

  const handleCreateProvider = async () => {
    if (!newProviderName.trim()) return;
    setIsCreatingProvider(true);
    const res = await crearProveedor(newProviderName);
    setIsCreatingProvider(false);
    if (res.success && res.data) {
      toast.success("Proveedor creado");
      setProviders([...providers, res.data]);
      setValue("proveedorId", String(res.data.id));
      setNewProviderName("");
    } else { toast.error(res.error || "Error"); }
  };

  const handleCreateMarca = async () => {
    if (!newMarcaName.trim() || !proveedorIdWatch) return;
    setIsCreatingMarca(true);
    const res = await crearMarca({ nombre: newMarcaName, proveedorId: Number(proveedorIdWatch) });
    setIsCreatingMarca(false);
    if (res.success && res.data) {
      toast.success("Marca creada");
      setMarcas([...marcas, res.data]);
      setValue("marcaId", String(res.data.id));
      setNewMarcaName("");
    } else { toast.error(res.error || "Error"); }
  };

  const handleCreateCategoria = async () => {
    if (!newCategoriaName.trim()) return;
    setIsCreatingCategoria(true);
    if (!marcaIdWatch) {
      toast.error("Para crear una categoría rápida, debe seleccionar una marca primero.");
      return;
    }
    const res = await crearCategoria(newCategoriaName, Number(marcaIdWatch));
    setIsCreatingCategoria(false);
    if (res.success && res.data) {
      toast.success("Categoría creada");
      setCategorias([...categorias, res.data]);
      setValue("categoriaId", String(res.data.id));
      setNewCategoriaName("");
    } else { toast.error(res.error || "Error"); }
  };

  const onSubmit = async (data: any) => {
    if (codigoArticuloEstado === "invalid" || codigoBarrasEstado === "invalid") {
      toast.error("Por favor corrija los códigos duplicados");
      return;
    }
    startTransition(async () => {
      const payload = {
        ...data,
        proveedorId: Number(data.proveedorId),
        marcaId: data.marcaId ? Number(data.marcaId) : null,
        categoriaId: data.categoriaId ? Number(data.categoriaId) : null,
      };
      let res;
      if (isEdit && initialData?.id) {
        res = await actualizarProducto(initialData.id, payload);
      } else {
        res = await crearProducto(payload);
      }
      if (res.success) {
        toast.success(`Producto ${isEdit ? "actualizado" : "creado"} correctamente.`);
        router.push("/inventario");
      } else {
        toast.error(res.error || "Error al guardar el producto.");
      }
    });
  };

  const stockStep = getStepParaMedicion(tipoMedicion);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 relative">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLUMNA IZQUIERDA */}
        <div className="lg:col-span-2 space-y-8">

          <Card className="shadow-sm border-muted/50 overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 to-purple-500"></div>
            <CardHeader><CardTitle className="text-xl">Información General</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="nombre_producto">Nombre de Producto <span className="text-red-500">*</span></Label>
                <Input id="nombre_producto" {...register("nombre_producto")} className="text-lg bg-muted/30 focus-visible:ring-indigo-500" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo_articulo">Código de Artículo <span className="text-red-500">*</span></Label>
                  <Input id="codigo_articulo" {...register("codigo_articulo")} onBlur={(e) => handleCheckUnique("codigo_articulo", e.target.value)} className="bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo_barras">Código de Barras <span className="text-slate-400 text-xs font-normal">(Opcional)</span></Label>
                  <Input id="codigo_barras" {...register("codigo_barras")} onBlur={(e) => handleCheckUnique("codigo_barras", e.target.value)} className="bg-muted/30" placeholder="0" />
                </div>
              </div>

              {/* STOCK MINIMO con step dinámico */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Stock Mínimo Recomendado (Global)</Label>
                  <Input type="number" step={stockStep} {...register("stock_recomendado")} className="bg-muted/30 max-w-[200px]" />
                </div>
                {!isEdit && arrDepositos && arrDepositos.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <Label className="mb-3 block text-indigo-600 font-bold">Stock Inicial Físico (Por Depósito)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {stockFields.map((field, index) => {
                        const depo = arrDepositos.find(d => String(d.id) === String((field as any).depositoId));
                        if (!depo) return null;
                        return (
                          <div key={field.id} className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl space-y-2">
                            <Label className="text-xs font-semibold text-slate-700">{depo.nombre}</Label>
                            <Input type="number" step={stockStep} {...register(`stocks.${index}.cantidad` as const)} className="bg-white" />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isEdit && (
                  <div className="pt-4 border-t border-slate-100">
                     <p className="text-xs text-orange-600 bg-orange-50 p-3 rounded-lg border border-orange-100">El stock físico de los artículos solo puede modificarse mediante Ajustes desde el Inventario Múltiple.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-muted/50">
            <CardHeader><CardTitle className="text-xl">Costos e Impuestos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label>Precio Costo</Label>
                  <Input type="number" step="0.01" {...register("precio_costo")} className="bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label>Desc. Proveedor (%)</Label>
                  <Input type="number" step="0.1" {...register("descuento_proveedor")} className="bg-muted/30" />
                </div>
                <div className="space-y-2">
                  <Label>Alícuota IVA (%)</Label>
                  <Input type="number" step="0.1" {...register("alicuota_iva")} className="bg-muted/30" />
                </div>
              </div>

              {/* Cascading preview */}
              <div className="mt-8 p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-background to-background rounded-xl border">
                <div className="flex w-full items-center justify-between text-sm mb-4">
                  <span className="text-muted-foreground font-medium">Costo Neto: <span className="text-foreground ml-1">${costoNetoVisual.toFixed(2)}</span></span>
                  <Separator orientation="vertical" className="h-4" />
                  <span className="text-muted-foreground font-medium">+ IVA: <span className="text-foreground ml-1">${costoIvaVisual.toFixed(2)}</span></span>
                </div>

                {(aumProv > 0 || aumMarca > 0 || aumCat > 0) && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {aumProv > 0 && <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Prov: +{aumProv}%</span>}
                    {aumMarca > 0 && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">Marca: +{aumMarca}%</span>}
                    {aumCat > 0 && <span className="text-[10px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-bold">Cat: +{aumCat}%</span>}
                  </div>
                )}

                <div className="flex flex-col items-center text-center">
                  <span className="text-sm font-semibold uppercase text-indigo-500 tracking-wider mb-1">Costo Final (Base Cascada)</span>
                  <span className="text-4xl font-bold tracking-tighter">
                    ${(costoIvaVisual * (1 + aumProv / 100) * (1 + aumMarca / 100) * (1 + aumCat / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-indigo-500/20">
            <CardHeader><CardTitle className="text-xl">Asignación de Listas Globales</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const globalList = initialListas.find(l => l.id === (field as any).listaPrecioId) || initialListas[index];
                  const nombreLista = globalList?.nombre || "Lista";
                  const margenDefault = globalList?.margen_defecto || 0;

                  const isActive = watch(`listas_precios.${index}.isActive`);
                  const margenPers = watch(`listas_precios.${index}.margen_personalizado`);

                  const isCustomValid = margenPers !== null && margenPers !== undefined && margenPers !== "" && !isNaN(Number(margenPers));
                  const margenFinal = isCustomValid ? Number(margenPers) : Number(margenDefault);
                  const precioFinal = calcularPrecioConCascada(
                    Number(precioCosto), Number(descuentoProveedor), Number(alicuotaIva),
                    aumProv, aumMarca, aumCat, margenFinal
                  );

                  return (
                    <div key={field.id} className={`relative grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-card border rounded-xl p-4 transition-all ${isActive ? 'border-indigo-500/50 shadow-indigo-500/10 shadow-sm' : 'opacity-60 grayscale-[30%]'}`}>
                      <div className="md:col-span-1 flex items-center justify-center">
                        <Controller control={control} name={`listas_precios.${index}.isActive`} render={({ field: cbField }) => (
                          <Checkbox checked={cbField.value || false} onCheckedChange={cbField.onChange} className="h-6 w-6 rounded-md data-[state=checked]:bg-indigo-500 data-[state=checked]:border-indigo-500" />
                        )} />
                      </div>
                      <div className={`md:col-span-4 space-y-1 ${!isActive ? 'pointer-events-none' : ''}`}>
                        <Label className="text-sm font-bold text-foreground">{nombreLista}</Label>
                        <p className="text-xs text-muted-foreground">Margen Lista: {margenDefault}%</p>
                      </div>
                      <div className={`md:col-span-3 space-y-2 ${!isActive ? 'pointer-events-none' : ''}`}>
                        <Label className="text-xs uppercase text-muted-foreground">Margen Especial (%)</Label>
                        <div className="relative">
                          <Controller control={control} name={`listas_precios.${index}.margen_personalizado`} render={({ field: inputField }) => (
                            <Input type="number" step="0.1" disabled={!isActive} placeholder={`D.: ${margenDefault}`}
                              value={inputField.value ?? ""} onChange={(e) => { const val = e.target.value; inputField.onChange(val === "" ? null : Number(val)); }}
                              className="pr-7 bg-muted/30 focus-visible:ring-indigo-500" />
                          )} />
                          <span className="absolute right-3 top-2 text-muted-foreground">%</span>
                        </div>
                      </div>
                      <div className={`md:col-span-4 space-y-2 ${!isActive ? 'pointer-events-none' : ''}`}>
                        <Label className="text-xs uppercase text-muted-foreground">Precio Público</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-indigo-500 font-medium">$</span>
                          <Input type="text" readOnly value={isActive ? (precioFinal || 0).toFixed(2) : "0.00"}
                            className="pl-8 font-bold text-lg text-indigo-500 bg-indigo-500/10 border-indigo-500/20 focus-visible:ring-transparent" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* COLUMNA DERECHA */}
        <div className="space-y-8">
          <Card className="shadow-sm border-muted/50">
            <CardHeader><CardTitle className="text-lg">Configuración de Inventario</CardTitle></CardHeader>
            <CardContent className="space-y-6">

              {/* PROVEEDOR */}
              <div className="space-y-3">
                <Label>Distribuidor / Proveedor <span className="text-red-500">*</span></Label>
                <div className="flex flex-col gap-2">
                  <Controller control={control} name="proveedorId" render={({ field }) => {
                    const selected = providers.find(p => String(p.id) === String(field.value));
                    return (
                      <Select onValueChange={(val) => { field.onChange(val); setValue("marcaId", ""); setValue("categoriaId", ""); }} value={field.value ? String(field.value) : ""}>
                        <SelectTrigger className={`bg-muted/30 ${errors.proveedorId ? "border-red-500" : ""}`}>
                          <SelectValue placeholder="Seleccione Proveedor">{selected ? selected.nombre : "Seleccione Proveedor"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {providers.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                  }} />
                  <div className="flex gap-2">
                    <Input placeholder="Nuevo..." value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)} className="h-8 text-xs bg-muted/30" />
                    <Button type="button" variant="secondary" size="sm" onClick={handleCreateProvider} disabled={isCreatingProvider || !newProviderName.trim()} className="h-8 text-xs">
                      {isCreatingProvider ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* MARCA (cascada de proveedor) */}
              <div className="space-y-3">
                <Label>Marca <span className="text-slate-400 text-xs font-normal">(Hijo de Proveedor)</span></Label>
                <div className="flex flex-col gap-2">
                  <Controller control={control} name="marcaId" render={({ field }) => {
                    const selected = marcas.find(m => String(m.id) === String(field.value));
                    return (
                      <Select onValueChange={(val) => { field.onChange(val); setValue("categoriaId", ""); }} value={field.value ? String(field.value) : ""} disabled={!proveedorIdWatch}>
                        <SelectTrigger className="bg-muted/30">
                          <SelectValue placeholder="Sin marca">{selected ? selected.nombre : "Sin marca"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {marcas.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                  }} />
                  {proveedorIdWatch && (
                    <div className="flex gap-2">
                      <Input placeholder="Nueva marca..." value={newMarcaName} onChange={(e) => setNewMarcaName(e.target.value)} className="h-8 text-xs bg-muted/30" />
                      <Button type="button" variant="secondary" size="sm" onClick={handleCreateMarca} disabled={isCreatingMarca || !newMarcaName.trim()} className="h-8 text-xs">
                        {isCreatingMarca ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* CATEGORÍA (cascada de marca) */}
              <div className="space-y-3">
                <Label>Categoría <span className="text-slate-400 text-xs font-normal">(Hijo de Marca)</span></Label>
                <div className="flex flex-col gap-2">
                  <Controller control={control} name="categoriaId" render={({ field }) => {
                    const selected = categorias.find(c => String(c.id) === String(field.value));
                    return (
                      <Select onValueChange={field.onChange} value={field.value ? String(field.value) : ""}>
                        <SelectTrigger className="bg-muted/30">
                          <SelectValue placeholder="Sin categorizar">{selected ? selected.nombre : "Sin categorizar"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.nombre}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    );
                  }} />
                  <div className="flex gap-2">
                    <Input placeholder="Nueva..." value={newCategoriaName} onChange={(e) => setNewCategoriaName(e.target.value)} className="h-8 text-xs bg-muted/30" />
                    <Button type="button" variant="secondary" size="sm" onClick={handleCreateCategoria} disabled={isCreatingCategoria || !newCategoriaName.trim()} className="h-8 text-xs">
                      {isCreatingCategoria ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>

              <Separator />

              {/* UNIDAD DE MEDIDA */}
              <div className="space-y-3">
                <Label>Unidad de Medida</Label>
                <Controller control={control} name="tipo_medicion" render={({ field: selectField }) => (
                  <Select onValueChange={selectField.onChange} value={selectField.value}>
                    <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNIDAD">Unidades (C/U)</SelectItem>
                      <SelectItem value="KILO">Kilogramos (KG)</SelectItem>
                      <SelectItem value="LITRO">Litros (LTS)</SelectItem>
                      <SelectItem value="METROS">Metros (MTS)</SelectItem>
                      <SelectItem value="CAJA">Cajas</SelectItem>
                      <SelectItem value="PACK">Packs</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>

              {/* MONEDA */}
              <div className="space-y-3">
                <Label>Moneda Base</Label>
                <Controller control={control} name="moneda" render={({ field: selectField }) => (
                  <Select onValueChange={selectField.onChange} value={selectField.value}>
                    <SelectTrigger className="bg-muted/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ARS">Pesos Argentinos (ARS)</SelectItem>
                      <SelectItem value="USD">Dólares (USD)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-indigo-500/30 bg-indigo-500/5">
            <CardContent className="p-6">
              <Button type="submit" size="lg" className="w-full font-bold bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {isEdit ? "Guardar Cambios" : "Confirmar Alta"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}