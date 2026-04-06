"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Store, Loader2, LockKeyhole } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [errorMsg, setErrorMsg] = useState("");

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setErrorMsg("");
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            const res = await login(formData);
            if (res.success) {
                if (res.rol === 'VENDEDOR') {
                    router.push("/vendedor");
                } else {
                    router.push("/");
                }
                router.refresh(); // Refrescamos para que el layout lea la sesión
            } else {
                setErrorMsg(res.error || "Error desconocido");
            }
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">

                {/* Cabecera */}
                <div className="bg-indigo-600 p-8 text-center text-white flex flex-col items-center">
                    <div className="bg-white/20 p-4 rounded-2xl mb-4 backdrop-blur-sm">
                        <Store className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight">Tommasi POS</h1>
                    <p className="text-indigo-200 text-sm mt-1 font-medium">Sistema de Gestión y Facturación</p>
                </div>

                {/* Formulario */}
                <div className="p-8">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                        <LockKeyhole className="h-5 w-5 text-indigo-500" /> Iniciar Sesión
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Usuario</Label>
                            <Input name="username" required autoFocus className="h-12 bg-slate-50" placeholder="Ej: marcos" />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Contraseña</Label>
                            <Input name="password" type="password" required className="h-12 bg-slate-50" placeholder="••••••••" />
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm font-semibold rounded-lg border border-red-100 text-center">
                                {errorMsg}
                            </div>
                        )}

                        <Button type="submit" disabled={isPending} className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold text-base mt-4 shadow-sm">
                            {isPending ? <Loader2 className="animate-spin h-5 w-5" /> : "Ingresar al Sistema"}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}