// index.js
import { json } from 'micro';

export default async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  try {
    const data = await json(req);
    console.log('Booking ricevuta:', data);

    // qui potrai aggiungere la logica di integrazione Shopify o salvataggio
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    return res.end('Internal Server Error');
  }
};
