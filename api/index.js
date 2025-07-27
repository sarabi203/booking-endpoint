import fetch from 'node-fetch';

const SHOP   = process.env.SHOPIFY_STORE;
const TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const VER    = process.env.API_VERSION;

const CREATE_CUSTOMER = `
  mutation($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

const UPDATE_SMS_CONSENT = `
  mutation($input: CustomerSmsMarketingConsentUpdateInput!) {
    customerSmsMarketingConsentUpdate(input: $input) {
      customer {
        id
        smsMarketingConsent { marketingState marketingOptInLevel }
      }
      userErrors { field message }
    }
  }
`;

export default async function handler(req, res) {
  // ─── CORS ───────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { firstName, lastName, email, phone, birthdate } = req.body;

    // 1) customerCreate + metafield birthday
    const createResp = await fetch(`https://${SHOP}/admin/api/${VER}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'X-Shopify-Access-Token': TOKEN
      },
      body: JSON.stringify({
        query: CREATE_CUSTOMER,
        variables: {
          input: {
            firstName,
            lastName,
            email,
            phone: `+${phone.replace(/\D/g,'')}`,
            acceptsMarketing: true,
            metafields: [{
              namespace: "booking",
              key:       "birthday",
              type:      "date",
              value:     birthdate
            }]
          }
        }
      })
    }).then(r=>r.json());

    if (createResp.errors || createResp.data.customerCreate.userErrors.length) {
      console.error(createResp);
      return res.status(500).json({ error: createResp });
    }
    const customerId = createResp.data.customerCreate.customer.id;

    // 2) customerSmsMarketingConsentUpdate
    const smsResp = await fetch(`https://${SHOP}/admin/api/${VER}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'X-Shopify-Access-Token': TOKEN
      },
      body: JSON.stringify({
        query: UPDATE_SMS_CONSENT,
        variables: {
          input: {
            customerId,
            smsMarketingConsent: {
              marketingState:      "SUBSCRIBED",
              marketingOptInLevel: "SINGLE_OPT_IN"
            }
          }
        }
      })
    }).then(r=>r.json());

    if (smsResp.errors || smsResp.data.customerSmsMarketingConsentUpdate.userErrors.length) {
      console.error(smsResp);
      return res.status(500).json({ error: smsResp });
    }

    // 3) OK
    return res.status(200).json({ id: customerId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
