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
  basica: { title: 'Suscripción Plan V.E.A. - Básica (USD 5)', unit_price: 5000 },
  estandar: { title: 'Suscripción Plan V.E.A. - Estándar (USD 10)', unit_price: 10000 },
  premium: { title: 'Suscripción Plan V.E.A. - Premium (USD 15)', unit_price: 15000 }
};

app.get('/', (req, res) => {
  res.send('Servidor de V.E.A. funcionando correctamente 🚀');
});

app.post('/api/crear-preferencia', async (req, res) => {
  try {
    const planKey = (req.body && req.body.plan) ? String(req.body.plan).toLowerCase() : 'basica';
    const planConfig = PLANES[planKey] || PLANES.basica;

    const preference = new Preference(client);

    const resultado = await preference.create({
      body: {
        items: [
          {
            title: planConfig.title,
            quantity: 1,
            unit_price: planConfig.unit_price
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
      sandbox_init_point: resultado.sandbox_init_point
    });
  } catch (error) {
    console.error("Error al crear la preferencia:", error);
    res.status(500).json({ error: "No se pudo crear la preferencia de pago" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});