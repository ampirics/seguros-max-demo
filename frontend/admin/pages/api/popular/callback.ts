import type { NextApiRequest, NextApiResponse } from 'next';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

interface PopularMPOUT {
  CODRET: string;
  DESCRET: string;
  IDCOM: string;
  IDTRX: string;
  TOTAL: string;
  NROPAGOS: string;
  FECHATRX: string;
  FECHACONT: string;
  IDREG: string;
  NUMCOMP?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Solo aceptar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {

    // Popular envía el XML en el campo 'data' como form-urlencoded
    const xmlData = req.body.data || req.body;
    
    if (!xmlData) {
      console.error('❌ No se recibió data en el body');
      return res.status(400).send(generateErrorMPFIN('No se recibió XML'));
    }


    // Parsear el XML MPOUT
    let parsed: any;
    try {
      parsed = await parseXML(xmlData);
    } catch (parseError: any) {
      console.error('❌ Error parseando XML:', parseError);
      return res.status(400).send(generateErrorMPFIN('XML inválido'));
    }

    // Extraer datos del MPOUT
    const transmission = parsed?.transmission;
    if (!transmission?.data?.[0]?.MPOUT?.[0]) {
      console.error('❌ Estructura XML inválida:', parsed);
      return res.status(400).send(generateErrorMPFIN('Estructura XML incorrecta'));
    }

    const mpout = transmission.data[0].MPOUT[0];
    
    const paymentData: PopularMPOUT = {
      CODRET: mpout.CODRET?.[0] || '',
      DESCRET: mpout.DESCRET?.[0] || '',
      IDCOM: mpout.IDCOM?.[0] || '',
      IDTRX: mpout.IDTRX?.[0] || '',
      TOTAL: mpout.TOTAL?.[0] || '0',
      NROPAGOS: mpout.NROPAGOS?.[0] || '1',
      FECHATRX: mpout.FECHATRX?.[0] || '',
      FECHACONT: mpout.FECHACONT?.[0] || '',
      IDREG: mpout.IDREG?.[0] || '',
      NUMCOMP: mpout.NUMCOMP?.[0],
    };


    // SIEMPRE enviar al backend para procesar (incluso si es rechazo o pendiente)
    
    const backendResponse = await fetch(`${BACKEND_URL}/api/v1/payments/popular/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json();
      console.error('❌ Error del backend:', errorData);
      
      const mpfinError = generateMPFIN(
        paymentData.IDTRX, 
        '9999', 
        errorData.detail || 'Error procesando pago'
      );
      res.setHeader('Content-Type', 'application/xml');
      return res.status(200).send(mpfinError);
    }

    const result = await backendResponse.json();

    // Guardar resultado en sesión/cookie para mostrarlo en la página de recibo
    // Nota: Popular hace POST, no podemos redirigir directamente
    // En su lugar, respondemos MPFIN y el usuario debe ver el resultado en su banco
    
    // Determinar código de respuesta según CODRET
    let mpfinCode = '0000';
    let mpfinMessage = 'Transacción procesada exitosamente';
    
    if (paymentData.CODRET === '0000') {
      // ✅ Aprobada
      mpfinCode = '0000';
      mpfinMessage = 'Transacción exitosa';
    } else if (paymentData.CODRET === '0001') {
      // ❌ Rechazada
      mpfinCode = '0000'; // Respondemos OK al banco para confirmar que recibimos el mensaje
      mpfinMessage = 'Transacción rechazada registrada';
    } else if (paymentData.CODRET === '0002') {
      // ⏳ Pendiente de firma
      mpfinCode = '0000'; // Respondemos OK al banco
      mpfinMessage = 'Transacción pendiente registrada';
    }
    
    // ✅ Construir respuesta MPFIN para Popular
    const mpfinSuccess = generateMPFIN(paymentData.IDTRX, mpfinCode, mpfinMessage);
    

    // 🔄 IMPORTANTE: Popular espera respuesta MPFIN, pero también necesitamos
    // redirigir al usuario a la página de recibo
    // Banco Popular mostrará esta respuesta en un iframe/ventana
    
    // Construir URL de redirección con resultado del pago
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/payment/result/popular?` + new URLSearchParams({
      status: result.status || paymentData.CODRET === '0000' ? 'success' : paymentData.CODRET === '0001' ? 'failed' : 'pending',
      order_number: result.order_number || paymentData.IDTRX,
      transaction_id: result.transaction_id || paymentData.IDREG,
      amount: paymentData.TOTAL,
      message: result.message || paymentData.DESCRET,
      timestamp: Date.now().toString()
    }).toString();
    
    // Responder con HTML que incluye el MPFIN Y redirección automática
    const htmlResponse = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="2;url=${redirectUrl}">
  <title>Procesando pago...</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 1rem;
      backdrop-filter: blur(10px);
    }
    .spinner {
      border: 3px solid rgba(255,255,255,0.3);
      border-top: 3px solid white;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <h2>Procesando tu pago...</h2>
    <p>Serás redirigido en un momento</p>
    <p><small>Order: ${result.order_number || paymentData.IDTRX}</small></p>
  </div>
  
  <!-- MPFIN XML para Banco Popular (oculto) -->
  <div style="display:none;">
    ${mpfinSuccess}
  </div>
  
  <script>
    // Redirección automática como fallback
    setTimeout(() => {
      window.location.href = '${redirectUrl}';
    }, 2000);
    
    // Si estamos en iframe del banco, intentar redirigir parent
    if (window.parent !== window) {
      window.parent.location.href = '${redirectUrl}';
    }
  </script>
</body>
</html>
`;

    // Responder HTML con redirección
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(htmlResponse);

  } catch (error: any) {
    console.error('💥 Error crítico procesando callback de Popular:', error);
    
    const mpfinError = generateMPFIN('unknown', '9999', `Error del servidor: ${error.message}`);
    res.setHeader('Content-Type', 'application/xml');
    return res.status(500).send(mpfinError);
  }
}

/**
 * Genera XML MPFIN para responder a Banco Popular
 */
function generateMPFIN(idtrx: string, codret: string, description: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<MPFIN>
    <IDTRX>${idtrx}</IDTRX>
    <CODRET>${codret}</CODRET>
    <DESCODRET>${description}</DESCODRET>
</MPFIN>`;
}

/**
 * Genera MPFIN de error
 */
function generateErrorMPFIN(errorMessage: string): string {
  return generateMPFIN('unknown', '9999', errorMessage);
}

// Configuración para aceptar raw body y form-urlencoded
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
