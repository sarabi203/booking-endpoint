// index.js
import { json } from 'micro';

const SHOPIFY_STORE = 'sarabibeach.myshopify.com';      // cambia col tuo dominio shopify
const ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN; // definisci questa ENV var in Vercel

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  try {
    // 1) Leggi il body JSON inviato dal form
    const {
      firstName,
      lastName,
      email,
      phone,
      birthday,
      service,
      dateRequest,
      timeRequest,
      participants,
      notes,
      consentMarketing
    } = await json(req);

    // 2) Prepara la mutation GraphQL
    const mutation = `
      mutation customerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }
    `;

    // 3) Build dell'input, inclusi metafield e opt-in SMS+EMAIL
    const input = {
      firstName,
      lastName,
      email,
      phone,
      marketingOptInLevel: consentMarketing
        ? "SMS_AND_EMAIL"
        : "NONE",
      metafields: [
        {
          namespace: "custom",
          key: "birthday",
          type: "date",
          value: birthday.replace(/\//g, "-") // da GG/MM/AAAA a YYYY-MM-DD
        },
        {
          namespace: "custom",
          key: "service_requested",
          type: "single_line_text_field",
          value: service
        },
        {
          namespace: "custom",
          key: "date_requested",
          type: "date",
          value: dateRequest.replace(/\//g, "-")
        },
        {
          namespace: "custom",
          key: "time_requested",
          type: "single_line_text_field",
          value: timeRequest
        },
        {
          namespace: "custom",
          key: "participants",
          type: "number_integer",
          value: participants.toString()
        },
        {
          namespace: "custom",
          key: "notes",
          type: "multi_line_text_field",
          value: notes || ""
        }
      ]
    };

    // 4) Chiama l'Admin API di Shopify
    const response = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2023-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ADMIN_API_TOKEN
        },
        body: JSON.stringify({ query: mutation, variables: { input } })
      }
    );
    const result = await response.json();

    // 5) Controlla errori
    if (
      result.errors ||
      (result.data.customerCreate.userErrors.length > 0)
    ) {
      console.error("Shopify errors:", result);
      res.statusCode = 500;
      return res.end(
        JSON.stringify({ success: false, errors: result })
      );
    }

    // 6) Tutto OK: rispondi positivamente
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error("Internal error:", err);
    res.statusCode = 500;
    return res.end(
      JSON.stringify({ success: false, error: err.message })
    );
  }
}
