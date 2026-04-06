import Afip from '@afipsdk/afip.js';
import prisma from "@/lib/prisma";
import os from "os";
import fs from "fs";
import path from "path";

export async function getAfipClient() {
    const config = await prisma.empresaConfig.findFirst();

    const cuitStr = config?.cuit_facturacion?.replace(/[^0-9]/g, '') || "";
    const crt = config?.certificado_crt;
    const key = config?.clave_privada;
    const isProduction = config?.modo_produccion_afip === true;

    // 1. VALIDACIÓN ESTRICTA: Sin estos 3 datos, no podemos hablar con AFIP.
    if (!cuitStr || !crt || !key) {
        throw new Error("FACTURACION: Faltan configurar el CUIT, el Certificado (CRT) o la Clave Privada (KEY) en la pantalla de Configuración.");
    }

    const cuitNumber = Number(cuitStr);
    const tmpDir = os.tmpdir();

    // 2. CREACIÓN DE ARCHIVOS TEMPORALES
    // Nombres de archivo únicos por CUIT para evitar colisiones
    const certPath = path.join(tmpDir, `cert_${cuitNumber}.crt`);
    const keyPath = path.join(tmpDir, `key_${cuitNumber}.key`);

    // Escribir los certificados en el disco temporal para que la librería los lea
    fs.writeFileSync(certPath, crt);
    fs.writeFileSync(keyPath, key);

    // 3. INSTANCIACIÓN DE AFIP
    return new Afip({
        CUIT: cuitNumber,
        production: isProduction, // false = Homologación | true = Producción
        cert: certPath,
        key: keyPath,
        res_folder: tmpDir + path.sep,
    });
}

export async function getDatosClientePorCUIT(cuit: number) {
    try {
        const afip = await getAfipClient();
        
        // Ejecutamos con un timeout manual por si AFIP se queda colgado (muy común)
        const data: any = await Promise.race([
            afip.RegisterScopeFive.GetTaxpayerDetails(cuit),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout AFIP")), 8000))
        ]);

        if (!data) return { success: false, error: "No se encontró información para el CUIT provisto." };
        return { success: true, data };
    } catch (error: any) {
        console.error("Error al buscar CUIT en AFIP:", error.message || error);
        
        let mensaje = "CUIT inválido o los servidores de AFIP están caídos (intente luego).";
        if (error.message === "Timeout AFIP") {
            mensaje = "Los servidores de AFIP tardaron demasiado en responder. Ingrese los datos manualmente.";
        } else if (error.message?.includes("FACTURACION")) {
            mensaje = error.message; // Propagar nuestro error de configuración
        }
        
        return { success: false, error: mensaje };
    }
}

export async function emitirComprobanteAFIP(
    tipoComprobante: string,
    puntoVenta: number,
    clienteCuitDni: string,
    condicionIvaCliente: string,
    total: number
) {
    // Si no es factura fiscal, salimos rápido sin interactuar con AFIP.
    if (!["FACTURA_A", "FACTURA_B", "FACTURA_C"].includes(tipoComprobante)) {
        return null;
    }

    try {
        // --- MODO SIMULADOR (Para desarrollo sin conexión a AFIP) ---
        if (process.env.MOCK_AFIP === "true") {
            console.log("---- MOCK MODE AFIP ACTIVADO ----");
            let subNeto = total;
            let subIva = 0;
            if (tipoComprobante === "FACTURA_A" || tipoComprobante === "FACTURA_B") {
                subNeto = total / 1.21;
                subIva = total - subNeto;
            }
            return {
                cae: "12345678901234",
                cae_vto: new Date(new Date().setDate(new Date().getDate() + 10)),
                numero_factura: Math.floor(Math.random() * 1000) + 1,
                importe_neto: subNeto,
                importe_iva: subIva,
                cuit_emisor: 20000000000
            };
        }
        // -----------------------------------------------------------

        const afip = await getAfipClient();

        let cbteTipo = 6; // Factura B por defecto
        let docTipo = 99; // 99: Consumidor Final / Sin Identificar
        let docNro = 0;

        let subtotalNeto = total;
        let subtotalIva = 0;

        // Calcular Neto e IVA (21% por defecto para simplificar).
        if (tipoComprobante === "FACTURA_A" || tipoComprobante === "FACTURA_B") {
            subtotalNeto = total / 1.21;
            subtotalIva = total - subtotalNeto;
        }

        // Lógica para Documento del cliente
        const cleanedDocument = clienteCuitDni ? clienteCuitDni.replace(/[^0-9]/g, '') : '';

        // 1. Determinar Condición IVA Receptor según Tipo de Comprobante (Reglas ARCA)
        let condicionIvaReceptorId = 5; // 5: Consumidor Final por defecto
        if (tipoComprobante === "FACTURA_A") {
            condicionIvaReceptorId = (condicionIvaCliente === "Monotributo") ? 6 : 1;
        } else if (tipoComprobante === "FACTURA_B") {
            // La B solo puede ir a CF (5) o Exentos (4) sin importar cómo lo hayamos guardado en DB
            condicionIvaReceptorId = (condicionIvaCliente === "Exento") ? 4 : 5;
        } else if (tipoComprobante === "FACTURA_C") {
            if (condicionIvaCliente === "Responsable Inscripto" || condicionIvaCliente === "RESPONSABLE_INSCRIPTO") condicionIvaReceptorId = 1;
            else if (condicionIvaCliente === "Monotributo") condicionIvaReceptorId = 6;
            else if (condicionIvaCliente === "Exento") condicionIvaReceptorId = 4;
            else condicionIvaReceptorId = 5;
        }

        // 2. Comprobando Documentos y Setos
        if (tipoComprobante === "FACTURA_A") {
            if (!cleanedDocument || cleanedDocument.length < 11) {
                throw new Error("FACTURACION: Factura A requiere un CUIT válido del cliente.");
            }
            if (condicionIvaCliente !== "RESPONSABLE_INSCRIPTO" && condicionIvaCliente !== "Responsable Inscripto" && condicionIvaCliente !== "Monotributo") {
                throw new Error("FACTURACION: El cliente debe estar registrado como Responsable Inscripto o Monotributista para emitir Factura A.");
            }
            cbteTipo = 1; // Factura A
            docTipo = 80; // CUIT
            docNro = Number(cleanedDocument);
        } else if (tipoComprobante === "FACTURA_B" || tipoComprobante === "FACTURA_C") {
            cbteTipo = tipoComprobante === "FACTURA_B" ? 6 : 11;
            if (cleanedDocument.length >= 7) {
                // Si es Consumidor Final (5), el DocTipo por regla de AFIP debería ser 96 (DNI).
                // Si nos pasaron un CUIT, intentamos extraer los 8 últimos dígitos para forzar el DNI,
                // salvo que supere el monto de identificación y realmente amerite adjuntar el CUIT como doc 80.
                if (condicionIvaReceptorId === 5 && total <= 100000 && cleanedDocument.length > 8) {
                    docTipo = 96; // DNI
                    docNro = Number(cleanedDocument.substring(2, 10)); // Extrae el DNI del medio del CUIT "20-12345678-9"
                } else {
                    docTipo = cleanedDocument.length > 8 ? 80 : 96;
                    docNro = Number(cleanedDocument);
                }
            } else if (total > 100000) {
                throw new Error("FACTURACION: Esta factura es mayor a $100.000 y requiere un DNI/CUIT válido cargado en el perfil del cliente.");
            }
        }

        const date = new Date(Date.now() - ((new Date()).getTimezoneOffset() * 60000)).toISOString().split('T')[0].replace(/-/g, '');
        const lastVoucher = await afip.ElectronicBilling.getLastVoucher(puntoVenta, cbteTipo);
        const numeroAEnviar = lastVoucher + 1;

        const data: any = {
            'CantReg': 1,
            'CbteTipo': cbteTipo,
            'PtoVta': puntoVenta,
            'Concepto': 1,
            'DocTipo': docTipo,
            'DocNro': docNro,
            'CbteDesde': numeroAEnviar,
            'CbteHasta': numeroAEnviar,
            'CbteFch': parseInt(date),
            'ImpTotal': Number(total.toFixed(2)),
            'ImpTotConc': 0,
            'ImpNeto': Number(subtotalNeto.toFixed(2)),
            'ImpOpEx': 0,
            'ImpTrib': 0,
            'MonId': 'PES',
            'MonCotiz': 1,
            'CondicionIVAReceptorId': condicionIvaReceptorId,
        };

        if (subtotalIva > 0 && (tipoComprobante === "FACTURA_A" || tipoComprobante === "FACTURA_B")) {
            data['ImpIVA'] = Number(subtotalIva.toFixed(2));
            data['Iva'] = [
                {
                    'Id': 5,
                    'BaseImp': Number(subtotalNeto.toFixed(2)),
                    'Importe': Number(subtotalIva.toFixed(2))
                }
            ];
        } else {
            data['ImpIVA'] = 0;
            if (tipoComprobante === "FACTURA_C") {
                data['ImpNeto'] = Number(total.toFixed(2));
            }
        }

        console.log("Datos a enviar a AFIP:", data);

        // Envío real a los servidores de AFIP
        const res = await afip.ElectronicBilling.createVoucher(data);

        return {
            cae: res.CAE,
            cae_vto: new Date(
                res.CAEFchVto.substring(0, 4) + '-' +
                res.CAEFchVto.substring(4, 6) + '-' +
                res.CAEFchVto.substring(6, 8)
            ),
            numero_factura: numeroAEnviar,
            importe_neto: subtotalNeto,
            importe_iva: subtotalIva,
            cuit_emisor: afip.CUIT
        };

    } catch (error: any) {
        console.error("Error en AFIP:", error);

        let errorMessage = error?.message || "Error desconocido";
        if (typeof error === 'string') errorMessage = error;

        let friendlyMessage = "Error interno de validación al comunicarse con AFIP.";

        if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("token")) {
            friendlyMessage = "Error 401 (No Autorizado): El certificado digital es inválido, está vencido, o el CUIT no coincide con el certificado cargado en Configuración.";
        } else if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
            friendlyMessage = "Error 403 (Prohibido): La IP del servidor no tiene permiso. Asegurate de que el certificado esté delegado para Web Services en la página de AFIP.";
        } else if (errorMessage.includes("ECONN") || errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
            friendlyMessage = "Error de Conexión: AFIP no responde actualmente (Timeout). Intentá de nuevo en unos minutos.";
        } else if (errorMessage.includes("10015")) {
            friendlyMessage = "Rechazado (10015): Inconsistencia de comprobantes. El último número enviado no se alínea con el registrado en AFIP.";
        } else if (errorMessage.includes("10016") || errorMessage.includes("10004")) {
            friendlyMessage = "Rechazado: El número de Documento o CUIT del cliente ingresado no existe en los padrones de AFIP o está inactivo.";
        } else if (errorMessage.includes("FACTURACION:")) {
            friendlyMessage = errorMessage; // Pasa limpios los errores internos nuestros pre-configurados.
        } else {
            friendlyMessage = `Detalle del rechazo AFIP: ${errorMessage}`;
        }

        throw new Error(friendlyMessage);
    }
}