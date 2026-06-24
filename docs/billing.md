# Billing Architecture

CloudPress billing uses a **base fee + additional usage fee** model. Every invoice is generated from provisioned product records and paid through PayPal using administrator-registered API credentials.

## PayPal requirements

```bash
wrangler secret put PAYPAL_CLIENT_ID
wrangler secret put PAYPAL_CLIENT_SECRET
```

Optional:

```bash
PAYPAL_API_BASE=https://api-m.paypal.com
```

## Billing flow

1. User provisions CloudPress products.
2. CloudPress computes base monthly fee and additional usage fee per product.
3. User creates `/api/billing/checkout`.
4. CloudPress creates a PayPal order with the monthly invoice amount.
5. The approval URL is returned to the console for payment.
6. Invoice and PayPal order IDs are stored in CloudPressDB.

## Product policy

- CloudPressDB: base monthly fee plus extra operation blocks.
- CP3: 50GB included, then 1,900 KRW per extra GB.
- WordPress/PHP: base monthly fee plus extra runtime usage.
- Static: no base fee, additional build/usage units when applicable.
- CloudPress DNS: zone count plus DNS query quota blocks.
- CP Observe: base monthly fee plus extra log volume.

## Traffic policy

All CloudPress hosting products use **unlimited traffic**, not unmetered traffic. Traffic is not a metered billing dimension, and invoices only include base fees plus explicit additional resource usage. Admin users are marked payment-exempt and receive waived invoices without PayPal payment.
