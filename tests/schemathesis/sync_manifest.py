"""
Mirror of FIELD_REGISTRY (src/lib/settings-schema.ts) for the conftest
round-trip checks. When the Zod registry changes, update this dict —
the snapshot test in src/lib/__tests__ keeps the TS side honest, and
this manifest keeps the fuzzer honest.
"""

# Fields where PATCH success must propagate to the Ultravox agent.
SYNC_TRIGGER_FIELDS = {
    "system_prompt",
    "forwarding_number",
    "transfer_conditions",
    "booking_enabled",
    "call_handling_mode",
    "agent_mode",
    "agent_voice_id",
    "knowledge_backend",
    "sms_enabled",
    "twilio_number",
}

# Fields the route silently ignores when the requester is not admin.
ADMIN_ONLY_FIELDS = {
    "calendar_beta_enabled",
    "telegram_bot_token",
    "telegram_chat_id",
    "twilio_number",
    "monthly_minute_limit",
    "knowledge_backend",
    "custom_niche_config",
}

# Mapping from request-body key -> Supabase column name.
# Identity for everything except the handful the route renames.
BODY_TO_COLUMN = {
    # Settings route writes column names verbatim for these — listed
    # explicitly so a column rename is caught loudly.
    "system_prompt": "system_prompt",
    "forwarding_number": "forwarding_number",
    "transfer_conditions": "transfer_conditions",
    "booking_enabled": "booking_enabled",
    "call_handling_mode": "call_handling_mode",
    "agent_mode": "agent_mode",
    "agent_voice_id": "agent_voice_id",
    "voice_style_preset": "voice_style_preset",
    "agent_name": "agent_name",
    "business_name": "business_name",
    "services_offered": "services_offered",
    "owner_name": "owner_name",
    "city": "city",
    "knowledge_backend": "knowledge_backend",
    "niche_custom_variables": "niche_custom_variables",
    "today_update": "today_update",
    "business_notes": "business_notes",
}
