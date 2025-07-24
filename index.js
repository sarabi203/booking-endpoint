// index.js
import { json } from 'micro'

/**
 * Variabili d’ambiente da impostare in Vercel:
 *   SHOPIFY_STORE         = "sarabibeach.myshopify.com"
 *   SHOPIFY_ADMIN_TOKEN   = "<il tuo Admin API token>"
 */
const SHOP       = process.env.SHOPIFY_STORE
const TOKEN      = process.env.SHOPIFY_ADMIN_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405
    return res.end('Method Not Allowed')
  }

  try {
    // 1) Leggi payload JSON dal form
    const {
      firstName, lastName, birthday,
      email, phone, service,
      dateRequest, timeRequest,
      participants, notes,
      consentMarketing
    } = await json(req)

    // 2) Genera password casuale per il nuovo customer
    const password = Math.random().toString(36).slice(-8)
                   + Math.random().toString(36).slice(-8)

    // 3) Prepara array dei metafield
    const metafields = [
      { namespace: 'custom', key: 'birthday',     value: birthday,    type: 'single_line_text_field' },
      { namespace: 'custom', key: 'service',      value: service,     type: 'single_line_text_field' },
      { namespace: 'custom', key: 'date_request', value: dateRequest, type: 'single_line_text_field' },
      { namespace: 'custom', key: 'time_request', value: timeRequest, type: 'single_line_text_field' },
      { namespace: 'custom', key: 'participants', value: participants.toString(), type: 'number_integer' },
      { namespace: 'custom', key: 'notes',        value: notes || '', type: 'multi_line_text_field' }
    ]

    // 4) Costruisci mutation GraphQL
    const query = `
      mutation customerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer { id }
          userErrors { field message }
        }
      }
    `
    const variables = {
      input: {
        firstName,
        lastName,
        email,
        phone,
        password,
        marketingOptInLevel: consentMarketing
          ? "SMS_AND_EMAIL"
          : "EMAIL",
        metafields
      }
    }

    // 5) Chiamata Admin API Shopify
    const shopUrl = `https://${SHOP}/admin/api/2023-07/graphql.json`
    const response = await fetch(shopUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN
      },
      body: JSON.stringify({ query, variables })
    })
    const result = await response.json()

    // 6) Gestisci errori GraphQL
    const errors = result.data?.customerCreate?.userErrors
    if (errors && errors.length) {
      console.error('Shopify errors:', errors)
      res.statusCode = 400
      return res.end(JSON.stringify({ success: false, errors }))
    }

    // 7) Risposta OK
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 200
    return res.end(JSON.stringify({ success: true }))
  }
  catch (err) {
    console.error('Internal error:', err)
    res.statusCode = 500
    return res.end(JSON.stringify({ success: false, message: 'Internal Server Error' }))
  }
}
