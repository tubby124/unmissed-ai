ALTER TABLE campaign_leads ADD COLUMN IF NOT EXISTS lead_status text CHECK (lead_status IN ('new', 'called_back', 'booked', 'closed')) DEFAULT NULL;
