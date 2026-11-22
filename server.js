const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference } = require('mercadopago');

const app = express();
const PORT = 3000;

// Habilitar CORS para que tu web (en Netlify u otro lado) pueda comunicarse con este servidor
app.use(cors());
app.use(express.json());

// Configuración de Mercado Pago con tu Access Token directo
const client = new MercadoPagoConfig({ 
  accessToken: '' 
});

// Ruta de prueba para verificar que el servidor responde
app.get('/', (req, res) => {
  res.send('Servidor de V.E.A. funcionando correctamente 🚀');
});

// Ruta para crear la preferencia de pago de Mercado Pago
app.get('/api/crear-preferencia', async (req, res) => {
  try {
    const preference = new Preference(client);
    
    const resultado = await preference.create({
      body: {
        items: [
          {
            title: 'Suscripción Plan V.E.A.',
            quantity: 1,
            unit_price: 5000
          }
        ],
        back_urls: {
          success: 'http://localhost:3000/exito',
          failure: 'http://localhost:3000/fallo',
          pending: 'http://localhost:3000/pendiente'
        }
      }
    });

    // Devolvemos un JSON con el init_point para que tu frontend lo abra sin problemas
    res.json({ init_point: resultado.init_point });
  } catch (error) {
    console.error("Error al crear la preferencia:", error);
    res.status(500).json({ error: "No se pudo crear la preferencia de pago" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});