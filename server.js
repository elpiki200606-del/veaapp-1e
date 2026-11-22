const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const PLANES = {
  basica:   { title: 'Suscripción Plan V.E.A. - Básica',   usd: 5,  fallbackArs: 8350 },
  estandar: { title: 'Suscripción Plan V.E.A. - Estándar', usd: 10, fallbackArs: 16700 },
  premium:  { title: 'Suscripción Plan V.E.A. - Premium',  usd: 15, fallbackArs: 25050 }
};

async function obtenerCotizacionDolarBlue() {
  try {
    const resp = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const cotizacion = Number(data.venta || data.compra);
    if (!cotizacion || Number.isNaN(cotizacion)) {
      throw new Error('Cotización blue inválida');
    }
    return cotizacion;
  } catch (err) {
    console.warn('[DÓLAR BLUE] Falló consulta en vivo, se usará precio de respaldo:', err.message);
    return null;
  }
}

app.get('/', (req, res) => {
  res.send('Servidor de V.E.A. funcionando correctamente 🚀');
});

app.post('/api/crear-preferencia', async (req, res) => {
  try {
    const planKey = (req.body && req.body.plan) ? String(req.body.plan).toLowerCase() : 'basica';
    const planConfig = PLANES[planKey] || PLANES.basica;

    const cotizacionBlue = await obtenerCotizacionDolarBlue();
    const montoFinal = cotizacionBlue
      ? Math.round(planConfig.usd * cotizacionBlue)
      : planConfig.fallbackArs;

    if (cotizacionBlue) {
      console.log(`[PAGO] Plan: ${planKey} | USD ${planConfig.usd} | Blue: $${cotizacionBlue} | Total ARS: $${montoFinal}`);
    } else {
      console.log(`[PAGO - RESPALDO] Plan: ${planKey} | USD ${planConfig.usd} | Total ARS: $${montoFinal}`);
    }

    const preference = new Preference(client);

    const resultado = await preference.create({
      body: {
        external_reference: planKey,
        items: [
          {
            title: `${planConfig.title} (USD ${planConfig.usd})`,
            quantity: 1,
            unit_price: montoFinal
          }
        ],
        back_urls: {
          success: 'https://elpiki200606-del.github.io/veaapp-1e/',
          failure: 'https://elpiki200606-del.github.io/veaapp-1e/',
          pending: 'https://elpiki200606-del.github.io/veaapp-1e/'
        },
        auto_return: 'approved'
      }
    });

    res.json({
      init_point: resultado.init_point,
      sandbox_init_point: resultado.sandbox_init_point,
      tipo_dolar: 'blue',
      usd: planConfig.usd,
      cotizacion_usada: cotizacionBlue,
      monto_ars: montoFinal,
      uso_respaldo: !cotizacionBlue
    });
  } catch (error) {
    console.error('Error al crear la preferencia:', error);
    res.status(500).json({ error: 'No se pudo crear la preferencia de pago' });
  }
});
app.get('/api/verificar-pago', async (req, res) => {
  try {
    const paymentId = req.query.payment_id || req.query.collection_id;
    if (!paymentId) {
      return res.status(400).json({ aprobado: false, error: 'Falta payment_id' });
    }

    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`
      }
    });

    if (!mpResp.ok) {
      return res.status(mpResp.status).json({ aprobado: false, error: 'No se pudo consultar el pago en Mercado Pago' });
    }

    const pago = await mpResp.json();
    const aprobado = pago.status === 'approved';
    const plan = pago.external_reference || null;

    res.json({
      aprobado,
      status: pago.status,
      plan,
      payment_id: pago.id
    });
  } catch (error) {
    console.error('Error al verificar pago:', error);
    res.status(500).json({ aprobado: false, error: 'Error interno al verificar pago' });
  }
});
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});