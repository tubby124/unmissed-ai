---
type: decision
date: 2026-03
status: approved
tags: [decision, n8n, architecture]
---

# Decision: Retire n8n for Voice Agents (Mar 2026)

## Context
Original architecture used n8n workflows for Ultravox agent orchestration.
All 4 production clients ran through n8n webhook triggers.

## Decision
Retire n8n for all voice agent calls. Move to Railway-native Next.js routes.

## Consequences
- All clients now Railway-native: hasan-sharif, exp-realty, windshield-hub, urban-vibe
- Exception 1: [[Clients/manzil-isa]] — still on n8n TEST MODE (not yet activated)
- Exception 2: Hasan Calendar Tools — n8n still handles calendar webhook (production remnant)
- n8n remains for: Manzil ISA + Hasan calendar bridge only

## Why
- n8n added latency to call setup
- Railway-native enables tighter Supabase integration
- Single codebase for all webhook handling
