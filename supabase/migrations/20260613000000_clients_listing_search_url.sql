-- lookupListing tool gate (real-estate inbound listing lookup)
--
-- When set, buildAgentTools() registers the lookupListing HTTP tool, which
-- proxies /api/webhook/{slug}/listing-lookup → this URL (a listing-search API
-- on the client's own website). Admin-set only (no dashboard UI yet): set via
-- SQL, then run syncClientTools so clients.tools picks it up.

ALTER TABLE clients ADD COLUMN IF NOT EXISTS listing_search_url text NULL;

COMMENT ON COLUMN clients.listing_search_url IS
  'Base URL of the client''s public listing-search API (e.g. https://hasansharif.ca/api/listings/search). When set, the lookupListing tool is registered for inbound calls.';
