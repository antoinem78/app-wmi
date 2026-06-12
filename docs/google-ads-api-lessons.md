# Google Ads API — hard-won lessons (from a prior POC, v20)

Notes from earlier hands-on work against the Google Ads API. Directly relevant
to Phase 4 (linking), Phase 6 (reporting), and any future campaign-management
work. Re-verify version-specific details against the current API version
(the design doc targets v24 as of June 2026), but treat these as the defaults.

1. **Pass the developer token as an explicit header on every call** —
   `developer-token: <token>`. Do not rely on framework/client-library
   credential injection; it has silently failed before (requests go out
   without the header and fail in confusing ways).

2. **Budget creation requires an explicit `name` AND `explicitlyShared: false`.**
   Omitting either causes rejections or unintentionally shared budgets.

3. **A bidding strategy is mandatory on campaign creation.** `manualCpc` is an
   acceptable default; campaigns without any strategy are rejected.

4. **Language targeting is read-only on the Campaign resource.** Set languages
   via `campaignCriteria:mutate` (same place as location criteria), not on the
   campaign itself.

5. **EU political advertising declaration is mandatory since April 2026.**
   Every campaign must declare its status — for our use:
   `DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING`.

6. **Geo targeting needs a real name→geo-ID lookup** (GeoTargetConstantService
   / `geoTargetConstants:suggest`), not a hardcoded list. Names are ambiguous
   ("Manchester") and IDs change.

7. **Idempotency key pattern for write operations:**
   `{tenantId, localCampaignId, actionType}` — dedupe on this before
   dispatching mutations so retries/replays never double-create. (In the
   current single-tenant portal, tenantId = the entity instance.)

Phase 4 addendum (from the linking brief):
- All linking calls authenticate as the PPC Mastery MCC: set the
  `login-customer-id` header to the MCC's 10-digit ID (digits only). If a
  call fails with permission errors despite valid credentials, **check this
  header first**.
- Link invitations: `CustomerClientLinkService` mutate creating a link with
  status `PENDING`, sent from the MCC. No webhooks exist for link status —
  poll (scheduled check or manual refresh).
