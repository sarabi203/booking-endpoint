// index.js
import { json } from 'micro';
import fetch from 'node-fetch';

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

export default async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end('Method Not Allowed');
  }

  try {
    const data = await json(req);
    // 1) customerCreate via Storefront API
    const password = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);
    const storefrontResp = await fetch(`https://${SHOP}/api/2023-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': data.storefrontToken
      },
      body: JSON.stringify({
        query: `
          mutation customerCreate($input: CustomerCreateInput!) {
            customerCreate(input: $input) {
              customer { id }
              userErrors { field message }
            }
          }
        `,
        variables: { input: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          acceptsMarketing: data.consentMarketing,
          password
        } }
      })
    });
    const sfJson = await storefrontResp.json();
    const customerId = sfJson.data.customerCreate.customer.id;

    // 2) customerUpdate via Admin API (marketing sms + metafields)
    const adminBody = {
      customer: {
        id: customerId.replace('gid://shopify/Customer/', ''),
        acceptsMarketing: data.consentMarketing,
        acceptsMarketingSms: data.consentMarketing
      },
      metafields: [
        { namespace: 'integrazione', key: 'birthday', value: data.birthday, type: 'single_line_text_field' },
        { namespace: 'integrazione', key: 'service',  value: data.service,  type: 'single_line_text_field' },
        { namespace: 'integrazione', key: 'dateRequest',  value: data.dateRequest,  type: 'single_line_text_field' },
        { namespace: 'integrazione', key: 'timeRequest',  value: data.timeRequest,  type: 'single_line_text_field' },
        { namespace: 'integrazione', key: 'participants',  value: String(data.participants),  type: 'number_integer' },
        { namespace: 'integrazione', key: 'notes',  value: data.notes||'',  type: 'single_line_text_field' }
      ]
    };
    await fetch(`https://${SHOP}/admin/api/2023-07/customers/${adminBody.customer.id}.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ADMIN_TOKEN
      },
      body: JSON.stringify({ customer: adminBody.customer })
    });
    // e poi uno per ogni metafield
    await Promise.all(adminBody.metafields.map(mf =>
      fetch(`https://${SHOP}/admin/api/2023-07/customers/${adminBody.customer.id}/metafields.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': ADMIN_TOKEN
        },
        body: JSON.stringify({ metafield: mf })
      })
    ));

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ success: true }));
  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'Internal Server Error' }));
  }
};
