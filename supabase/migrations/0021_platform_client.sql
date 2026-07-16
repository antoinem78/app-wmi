-- 0021_platform_client.sql
-- Phase 1 of the SingularWeb platform integration (one engine, many doorways, R13).
-- The client-identity spine: one client = one identity across the two planes
-- (Engine A = this DB, delivery/acquisition; Engine B = the agent substrate, a
-- SEPARATE Supabase project). We MAP, we do not migrate. engine_b_client_id is a
-- stored uuid reference into the substrate DB; no cross-DB FK by design.
--
-- doorway records who sold/owns the relationship (honest attribution):
--   wmi_legacy  = the existing WMI ad book (pre-doorway direct clients)
--   dentalmastery = the dental vertical doorway
--   rexos       = the direct/horizontal doorway (no clients until rexos.ai funnel opens)
--   NULL        = SingularWeb's own properties (is_own_property = true)

CREATE TABLE IF NOT EXISTS platform_client (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  doorway text,
  engine_a_client_id uuid,
  engine_b_client_id uuid,
  ghl_location_id text,                       -- nullable; seeds the map where present, manual mapping otherwise
  google_ads_customer_id text,
  is_own_property boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_client_engine_a ON platform_client (engine_a_client_id) WHERE engine_a_client_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_client_engine_b ON platform_client (engine_b_client_id) WHERE engine_b_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_client_ghl ON platform_client (ghl_location_id);
CREATE INDEX IF NOT EXISTS idx_platform_client_doorway ON platform_client (doorway);

-- Seed from live reality (2026-07-16). KST is the one cross-plane client today.
INSERT INTO platform_client (name, doorway, engine_a_client_id, engine_b_client_id, ghl_location_id, google_ads_customer_id, is_own_property, notes)
VALUES
  ('3daistudio.com', 'wmi_legacy', 'b7e776cb-4838-4efc-80c3-defc0696b548', NULL, NULL, NULL, false, NULL),
  ('Account 2367242101', 'wmi_legacy', '8db92f9f-dfe3-4733-ab94-136c85239cc6', NULL, NULL, NULL, false, NULL),
  ('Belgravia', 'wmi_legacy', 'a0a28b73-9d02-4ba0-9587-36a1ed79ad9b', NULL, NULL, NULL, false, NULL),
  ('COARNG - Blueprint', 'wmi_legacy', 'f048aa50-7315-4363-ad77-33dff8d8ccd9', NULL, NULL, NULL, false, NULL),
  ('EstesPerformanceConcaves', 'wmi_legacy', '5db976a1-b6ad-49a7-9731-1b59b097f7a1', NULL, NULL, NULL, false, NULL),
  ('FiltersFast.com', 'wmi_legacy', '89cfafc6-d51c-4712-b716-83c388493aad', NULL, NULL, NULL, false, NULL),
  ('Fly-Rides', 'wmi_legacy', '64973e12-8c9e-46a9-8e65-40282c17ca05', NULL, NULL, NULL, false, NULL),
  ('House Of Isabella UK', 'wmi_legacy', '661bae06-7645-4070-8c96-155af1e389ed', NULL, NULL, NULL, false, NULL),
  ('KST Accountants Limited', 'wmi_legacy', 'e97a0e8e-9d73-4333-a982-0ff46649c68c', 'a6cc693f-c00f-4623-b9fb-cfabeb2cdf02', 'Zts49PaUrbGfHuBtpknt', '4226686978', false, 'Legacy-book origin; client-2 full-matrix conversion (first full-engine client from the WMI book). Cross-plane anchor.'),
  ('Nashville DOT', 'wmi_legacy', '49f458b3-0914-4e3b-81b5-a9a8a066829f', NULL, NULL, NULL, false, NULL),
  ('Onebed.com.au', 'wmi_legacy', 'f96b0862-c149-40fc-bf56-3481216cb878', NULL, NULL, NULL, false, NULL),
  ('PakGizmo', 'wmi_legacy', 'a9c43177-20e8-4575-a858-fbbf1774bc2b', NULL, NULL, NULL, false, NULL),
  ('PakSouth', 'wmi_legacy', '0529fdce-35c9-4672-bb7d-c08cfe55cbd4', NULL, NULL, NULL, false, NULL),
  ('PerkBox', 'wmi_legacy', '0ce20bd5-6af6-41f8-ac51-a2b51f9e3cd6', NULL, NULL, NULL, false, NULL),
  ('QME', 'wmi_legacy', '98033975-a430-4f53-b4ef-ad1364b244b7', NULL, NULL, NULL, false, NULL),
  ('SGT KNOTS Supply Co', 'wmi_legacy', '5a70af42-35be-43ec-a9a6-2b1ce19f2e5a', NULL, NULL, NULL, false, NULL),
  ('Xinzuo', 'wmi_legacy', 'e5e21686-25bd-47ab-9129-2b4f8062474f', NULL, NULL, NULL, false, NULL),
  ('Shallowford Family & Cosmetic Dentistry', 'dentalmastery', NULL, '453257e5-28fa-4973-8228-5420ec31f16c', 'TIFsKMB30YyyLu4SA4Xp', '2811805080', false, 'Dental doorway client; Engine B only (agent staged).'),
  ('DentalMastery', 'dentalmastery', NULL, 'a5f4ae96-7161-4022-877e-167d5b089372', 'YT3zkRv2oyeo1PSUQqVR', NULL, true, 'The dental doorway''s own B2B property (dentalmastery.ai).'),
  ('SingularWeb', NULL, NULL, '57464657-2479-4d99-a6b1-227395ad3f09', NULL, NULL, true, 'The engine''s own site (singularweb.ai); self-first surface.')
ON CONFLICT DO NOTHING;

-- zz-rehearsal-ghlnotes (synthetic) and Test Bark Flow (test) are deliberately not seeded.
