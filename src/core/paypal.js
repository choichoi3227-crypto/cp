export class PayPalClient {
  constructor(env = {}) {
    this.clientId = env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = env.PAYPAL_CLIENT_SECRET || '';
    this.baseUrl = env.PAYPAL_API_BASE || 'https://api-m.paypal.com';
    if (!this.clientId || !this.clientSecret) throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required.');
  }

  async createOrder(invoice) {
    const accessToken = await this.accessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: invoice.id,
          description: invoice.description,
          amount: { currency_code: invoice.currency, value: invoice.amount.toFixed(2) },
        }],
        application_context: { brand_name: 'CloudPress', user_action: 'PAY_NOW' },
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'PayPal order creation failed.');
    return { id: data.id, status: data.status, approveUrl: data.links?.find((link) => link.rel === 'approve')?.href };
  }

  async accessToken() {
    const credentials = btoa(`${this.clientId}:${this.clientSecret}`);
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'PayPal access token request failed.');
    return data.access_token;
  }
}
