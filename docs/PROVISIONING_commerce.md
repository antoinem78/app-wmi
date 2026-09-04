# Provisioning a Shopify commerce merchant

**Written 2026-07-31, as exercised against the synthetic merchant `zz-commerce-dev`, not before.** Each step below was performed at least once; where the real-merchant step differs from what was exercised, the difference is stated.

**Be honest about what this adds:** two per-merchant workflow objects (a receiver and an Admin API caller) plus two per-merchant secrets. This is the same class of exception to "config and content, never workflow edits" as the GHL per-client caller, and it exists for the same reason: n8n credentials bind design-time. It is a first-class provisioning step, not an anomaly.

## Shared infrastructure (exists once, already live)

| Object | Where | State |
|---|---|---|
| `commerce` schema, 4 tables + `verify_shopify_hmac()` | conversion plane | applied, migration `0004_commerce_schema.sql` |
| `commerce_writer` DB role | conversion plane | RLS-bound (no bypass); connection string in `~/.config/singularweb/substrate.env` as `COMMERCE_WRITER_URL`; n8n credential "Supabase — commerce writer" |
| `PROC_shopify_event` | n8n `y10xtJ3EbGPHHnqr` | ACTIVE (shared processor, one per estate) |
| `RCV_shopify_TEMPLATE` | n8n `avrKnnAHOJPF75lz` | inactive template |
| `SHOPIFY_admin_caller_TEMPLATE` | n8n `FcjAlpnAJNl0vpTC` | inactive template |
| `CAP_commerce_reconcile` | n8n `Z0xzANhFBuVTBuPy` | ACTIVE (daily 07:30 London; sweeps every enabled commerce client) |
| `GHL_contact_caller_TEMPLATE` | n8n `HnplslA8l3jGajg3` | inactive template (non-commerce gap closed in passing) |
| `commerce_ingest` operators row | conversion plane | inserted by 0004 |

## Per-merchant steps, in order

1. **Client row and config.** Insert (or extend) the `public.clients` row. `config.commerce`:
   ```
   { "enabled": true, "platform": "shopify", "shop_domain": "<store>.myshopify.com",
     "api_version": "2026-04", "receiver_workflow_id": null, "shopify_caller_workflow_id": null }
   ```
   `shop_domain` is the resolution key; get it exactly right (the `.myshopify.com` domain, not the storefront domain). Enabled=true is what makes the row visible to `commerce_writer` and the reconcile sweep.

2. **Merchant custom app** (real merchant only; skipped for the synthetic). The merchant creates a custom app in their Shopify admin, scopes `read_orders, read_checkouts, read_products, read_customers`, and hands over two values: the **Admin API access token** and the **API secret key** (the webhook signing secret).

3. **Webhook secret into the substrate.** With the admin connection (never `commerce_writer`, which can only read):
   ```sql
   INSERT INTO commerce.merchant_secrets (client_id, name, secret) VALUES ($client, 'shopify_hmac', $secret)
   ON CONFLICT (client_id, name) DO UPDATE SET secret = EXCLUDED.secret;
   ```
   The secret lives only here. Not in config, not in workflow JSON, not in an n8n credential: the receiver verifies through `commerce.verify_shopify_hmac()`, so the secret never enters n8n execution data.

4. **Receiver.** Duplicate `RCV_shopify_TEMPLATE` → `RCV_shopify_<slug>`. Set the webhook path to `shopify-rcv-<slug>-<12 random hex>` (unguessable suffix; `openssl rand -hex 6`). Nothing else changes; the DB credential is already bound on the template.

5. **Caller.** Duplicate `SHOPIFY_admin_caller_TEMPLATE` → `SHOPIFY_admin_caller_<slug>`. Create an n8n credential `Shopify Admin — <Client>` (type httpHeaderAuth, header `X-Shopify-Access-Token`, value = the Admin token from step 2) and bind it on all three HTTP nodes, replacing the TEMPLATE placeholder credential.

6. **Record both workflow ids in config**: `receiver_workflow_id`, `shopify_caller_workflow_id`. Audit trail plus reconcile invocation; routing stays by URL.

7. **Activate, in this order:** `PROC_shopify_event` first if ever inactive, then the receiver, then the caller. n8n 2.31.5 refuses to publish a workflow whose statically referenced sub-workflow is unpublished, so the processor must be live before any receiver that names it.

8. **Register the six v1 webhook topics** against the receiver URL (`https://singularweb.app.n8n.cloud/webhook/<path>`): `orders/create`, `orders/updated`, `refunds/create`, `checkouts/create`, `checkouts/update`, `customers/update`. Exercised 2026-08-11 against the dev store; the exact call, once per topic:
   ```
   POST https://<store>.myshopify.com/admin/api/2026-04/webhooks.json
   X-Shopify-Access-Token: <admin token>
   {"webhook": {"topic": "<topic>", "address": "https://singularweb.app.n8n.cloud/webhook/<path>", "format": "json"}}
   ```
   Read back with `GET .../webhooks.json` and confirm all six. **Version pinning finding:** the registration path's API version does not set the payload version; the subscription pins to the app's webhook API version (ours came back `2026-07` despite registering via `2026-04`). Assume payloads arrive in the app's version and check the contract against it.

9. **Prove one order end to end** before declaring the merchant connected: place a test order (or send one signed synthetic payload), then confirm all five artefacts: HTTP 200, a `commerce.events` row, a `commerce.orders` row, a `tasks` row (`source='shopify_webhook'`, `operator_id='commerce_ingest'`), and `action_log` steps `ingest` + `state_upserted`.

10. **Reconcile.** Once the caller exists, activate `CAP_commerce_reconcile` (daily 07:30 London). It compares 24h and 7d counts and value sums against the store and posts mismatches to `#alerts`. This is the harness Phase B's fourteen-day gate runs on.

## Payload contract corrections (real edge, API version 2026-07, verified 2026-08-11)

- **Order webhooks no longer carry `customer.email_marketing_consent` or `customer.orders_count`.** The customer object arrives without either key, so order-level `consent_state` lands as `not_applicable` and `order_sequence` as null. This is Shopify's payload slimming, not a bug in the processor, which handles the absence correctly. **Checkout consent (`buyer_accepts_marketing`) is the reliable consent surface** and is what the cart-abandonment gate reads; it verified correctly in both states at the real edge. If Phase B wants order sequence, it comes from a customers read through the caller, not from the order payload.
- **Checkout webhooks fire on nearly every buyer keystroke**: one real checkout produced 16 update events. The updated_at guard makes this harmless, but expect volume.
- **The completion link works in both arrival orders** (checkout before order and order before checkout), proven live on two checkouts.
- **Test-store gotchas:** a test order consumes inventory (product shows sold out until quantity is raised or tracking unticked), and the storefront sits behind the password in Online Store → Preferences.
- **n8n operational note:** updating an ACTIVE scheduled workflow via the API can leave its schedule trigger stale. After any PUT to an active workflow, deactivate then reactivate to re-register the trigger.

## Failure modes to expect

- **401 + Slack alert on every delivery** means the wrong signing secret in step 3 (Shopify retries against 401s loudly rather than being swallowed; that is deliberate, ruling D3b).
- **`unknown_shop_domain` alerts** mean the `shop_domain` in config does not exactly match the `X-Shopify-Shop-Domain` header.
- **Duplicate deliveries are normal** Shopify behaviour; they land as `action_log` `duplicate_skipped` and touch nothing.
- **A reconcile "page cap hit (250)" alert** means the store does more than 250 orders a week and the caller needs pagination before its numbers mean anything.
