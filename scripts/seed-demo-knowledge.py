#!/usr/bin/env python3
"""
Seed high-quality knowledge chunks for unmissed-demo (Zara).
Uses OpenAI embeddings directly + Supabase insert.

Usage: source ~/.secrets && python3 scripts/seed-demo-knowledge.py
"""

import os, json, requests, sys
from datetime import datetime, timezone

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
SUPABASE_URL = "https://qwhvblomlgeapzhnuwlb.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

if not OPENAI_API_KEY:
    print("ERROR: OPENAI_API_KEY not set"); sys.exit(1)
if not SUPABASE_KEY:
    print("ERROR: SUPABASE_SERVICE_KEY not set"); sys.exit(1)

# Get unmissed-demo client ID
r = requests.get(
    f"{SUPABASE_URL}/rest/v1/clients?slug=eq.unmissed-demo&select=id",
    headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"}
)
CLIENT_ID = r.json()[0]["id"]
print(f"Client ID: {CLIENT_ID}")

SOURCE = "bulk_import"
SOURCE_RUN_ID = f"zara-knowledge-seed-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"

CHUNKS = [
    # ── What missed calls actually cost you ──
    {
        "content": "Q: How much does a missed call actually cost?\nA: Depends on your business. If you're an auto glass shop, one missed call is a $200-500 windshield job gone. Plumber? That's a $350-500 emergency call you just lost. Heating and cooling company — $300 to $1200 per service call. Dental office — a new patient is worth $150-400 over time. Real estate agent — a missed buyer call could be $2000-8000 in commission. Lawyers lose the most — a new client could be worth $3000 to $50000. Bottom line — every missed call is real money walking out the door.",
        "chunk_type": "qa",
    },
    {
        "content": "Over 60 percent of calls to small businesses go unanswered. And here's the kicker — 85 percent of people who get your voicemail just hang up and call someone else. They don't leave a message. More than half of missed calls happen after hours — nights, weekends, lunch breaks. So most businesses are losing leads every single day and don't even realize it.",
        "chunk_type": "fact",
    },
    {
        "content": "Q: Why not just hire a receptionist?\nA: A receptionist costs $31000 to $42000 a year. And they still can't answer at midnight or on a long weekend. unmissed.ai is $20 a month — that's $240 a year. If you save just one or two calls a month, you've already paid for the whole year. A plumber missing 8 calls a week at $200 each — that's over $83000 a year lost. The AI never calls in sick, never takes a lunch break, never misses a Saturday morning emergency call.",
        "chunk_type": "qa",
    },

    # ── How it actually works ──
    {
        "content": "Q: How do I set this up? Do I need new equipment or a new phone number?\nA: Nope. You keep your existing business number — nothing changes for your customers. You just turn on call forwarding through your phone carrier. Takes about 30 seconds. Most carriers let you dial star-72 to turn it on and star-73 to turn it off. You can forward all calls, or just the ones you miss — like when you're busy or after hours. When someone calls your number and you don't pick up, it rings to us instead of voicemail. Your customers don't notice anything different — they just get a real answer instead of a beep.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: What happens when someone calls my number?\nA: Your AI agent picks up within one ring. It greets the caller using your business name — sounds like a real person at your front desk. It asks what they need, figures out if they're a real lead or just browsing, and captures their info. It can even book an appointment on your calendar right there on the call. You get an instant text and Telegram alert with the caller's name, phone number, what they wanted, and whether it's a hot lead or not. If it's urgent, you can call them right back or the AI can connect you live.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: Does the AI get better over time?\nA: Yeah. After every call we look at what went well and what didn't — what questions came up that it didn't have a good answer for, where it hesitated, what callers asked about that we hadn't thought of. Then we add that info so next time it handles it better. It's like training a new employee but faster — most agents are noticeably better after 10 to 20 calls. We also do a weekly review that catches patterns you might not notice on your own.",
        "chunk_type": "qa",
    },

    # ── Features in plain english ──
    {
        "content": "Q: Can it actually book appointments while on the call?\nA: Yeah. It connects to your Google Calendar. When someone wants to book, the agent checks when you're free, offers a couple of times, and books it — all while still talking to the caller. Then it texts them a confirmation. No double-bookings, no back-and-forth. Works for any business — auto glass appointments, property showings, consults, whatever you do.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: Can it text people during the call?\nA: Yeah. If someone wants a link or some info, the agent can text it to them while they're still on the phone. It's pretty cool to see in action — you're talking and then your phone buzzes with the info right there. After the call it can also send an automatic follow-up text. And you as the owner get a text alert with the full summary and lead score the second the call ends.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: Can it transfer the call to me if the person wants to talk to a human?\nA: For sure. If someone's a serious buyer or just wants to talk to the boss, the AI can connect the call to you live — right in the middle of the conversation. It gives you a heads up with a text so you know who's calling and what they want before you even say hello. If you don't pick up it lets them know you'll call back within the hour.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: How do I know when someone calls? What kind of alerts do I get?\nA: You get a text and a Telegram message the second a call ends. It tells you the caller's name, their number, what they needed, and whether it's a hot lead or not. You also get a follow-up text sent to the caller automatically. And every morning at 8am you get a summary of all calls from the day before. So even if you're slammed all day, you start the morning knowing exactly what came in.",
        "chunk_type": "qa",
    },

    # ── How we compare ──
    {
        "content": "Q: How does your pricing compare to the other AI phone answering services?\nA: Most of them charge per minute on top of a monthly fee. So at 200 calls a month you're looking at $100 to $450 depending on the service. Smith dot ai is $95 a month plus per-call fees — adds up to $455. My AI Front Desk is $99 a month plus minutes. Dialzara starts at $29 but with per-minute charges hits $290. Ask Benny is $49 a month plus per-minute. We're $20 a month. Flat. 100 minutes included. No per-minute charges, no surprise bills. And we include everything — booking, live transfer, text follow-ups, lead scoring, daily digest. Other guys make you pay extra for those.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: How is this different from a regular answering service?\nA: Old-school answering services charge $1 to $2 per minute — that's $500 to $2000 a month if you get any real volume. They usually only work business hours. If you want to change the script it takes days. And all you get is a basic message log. We're $20 a month flat, we answer 24/7 including holidays, you can update how the agent talks anytime, and you get full call recordings, lead scores, calendar booking, live transfers, and instant alerts. Basically everything an answering service does but better, faster, and a fraction of the price.",
        "chunk_type": "qa",
    },

    # ── Who it's for ──
    {
        "content": "Q: What kind of businesses use this?\nA: Basically any business where a missed phone call means lost money. Auto glass shops — a cracked windshield call at 7pm that goes to voicemail is a $400 job gone. Property managers — tenants call about leaks and emergencies at 2am and need someone to pick up. Real estate agents — buyers move fast and if you don't answer they call the next agent. We also work great for plumbers, heating and cooling companies, dental offices, law firms, salons, print shops, and roofers. If phone calls are how you get customers, this is for you.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: How does it work for an auto glass shop?\nA: When someone calls about a cracked windshield, the agent asks the right questions — what's the year, make, and model of the vehicle? Does it have that camera up by the rearview mirror? Are they going through insurance? When do they wanna bring it in? It captures everything the shop needs to quote the job. The owner gets an instant alert with all the details and can call back with a price. No more losing those Saturday morning calls when a rock just hit somebody's windshield on the highway.",
        "chunk_type": "qa",
    },

    # ── Coming soon stuff ──
    {
        "content": "Q: Can it make outbound calls too?\nA: Right now it handles incoming calls — someone calls your number and the AI answers. But we have outbound calling coming soon. That means the AI could call your customers for things like appointment reminders, follow-ups on quotes, payment reminders, or even just checking in after a job. So eventually your AI handles both sides — catching new leads coming in and following up on the ones you already have.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: What about phone menus — like press 1 for this, press 2 for that?\nA: We can do that but honestly most of our clients don't need it. The AI just talks to people naturally — the caller says what they need and the agent figures it out. No menus, no waiting, no pressing buttons. But if you have multiple departments or need specific routing, we can set up menu options with hold music and everything. It's the best of both worlds — a natural conversation that still routes calls where they need to go.",
        "chunk_type": "qa",
    },

    # ── How the agent knows your business ──
    {
        "content": "Q: How does the AI know about my specific business?\nA: We build a custom knowledge base for you. It's basically a brain full of info about your business — your services, your hours, your service area, common questions you get, how you like to handle different types of calls. When a caller asks something specific, the agent pulls from that info to give a real answer — not a generic one. You can add to it anytime through your dashboard. And the more calls it handles, the smarter it gets because we spot gaps and fill them in.",
        "chunk_type": "qa",
    },

    # ── Setup & Trial ──
    {
        "content": "Q: How long does setup take?\nA: About 5 minutes. Go to unmissed.ai/onboard, answer a few questions about your business, pick your agent's voice, and you're live. Or if you don't wanna deal with it, we set the whole thing up for you — takes us about 48 hours. The $25 setup fee covers everything — your first 50 free minutes and a custom AI agent built for your industry. And the 7-day free trial is all features, no credit card needed.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: What happens after the free trial ends?\nA: It's $20 a month during our beta — that price locks in as long as you stay subscribed. After beta it goes to $30 a month for new sign-ups. You get 100 minutes a month included. If you go over you can grab a reload pack — $10 for 50 more minutes. No contracts, cancel anytime. Most people stick around because they see the value in the first week — one saved call pays for the whole month.",
        "chunk_type": "qa",
    },

    # ── Privacy and legal ──
    {
        "content": "Q: Is this legal? What about privacy and recording calls?\nA: Totally legal. We're a Canadian company and we follow all the rules — privacy laws, telecom regulations, the works. Calls are recorded and the caller is told upfront. All the data is stored securely and you own it — we don't sell it or share it with anyone. We use Canadian phone numbers. When outbound calling launches we'll make sure everything follows the anti-spam rules too. Your customers' info stays safe.",
        "chunk_type": "qa",
    },

    # ── Handling doubts ──
    {
        "content": "Q: What if my customers don't wanna talk to a robot?\nA: Honestly, most people don't even realize it's AI until you tell them. The voice sounds natural, it talks like a real person, it doesn't sound like those old automated systems. And here's the real question — what's the alternative? For most small businesses it's not a human receptionist. It's voicemail. And 85 percent of people who get voicemail just hang up and call someone else. So the choice isn't AI or a person — it's AI or a missed call. The AI wins every time.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: What if someone asks something the AI doesn't know?\nA: It doesn't guess or make stuff up. If a question comes up that it's not sure about, it says something natural like 'good question — let me have the boss get back to you on that' and makes sure your team follows up. You can also set it to transfer tricky calls straight to you in real time. The whole point isn't to replace you — it's to handle the easy stuff so you only deal with the calls that actually need your brain.",
        "chunk_type": "qa",
    },

    # ── The dashboard ──
    {
        "content": "Q: Is there a dashboard or something where I can see my calls?\nA: Yeah. You get a full dashboard where you can see every call — who called, when, what they wanted, the full recording and transcript, and how the AI scored them. You can see your hot leads, change your agent's settings, update what it knows about your business, check your minutes, everything. You also get a morning digest every day at 8am so you start the day knowing exactly what came in overnight.",
        "chunk_type": "qa",
    },

    # ── Psychology / "wow" moments ──
    {
        "content": "Q: Is this really what my customers would hear?\nA: Yeah — this call right now? This is exactly what your customers would hear when they call your business. Same voice, same style, same flow. The only difference is yours would know your business inside and out — your services, your hours, your pricing, your area. So while you're on a job or with a client or eating dinner, your AI is having this exact kind of conversation with your leads. And they're getting booked, not bounced to voicemail.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: Why should I care about missed calls? I have voicemail.\nA: Here's the thing — 85 percent of people who get your voicemail just hang up. They don't leave a message. They call the next business on Google. And you'll never even know they called. That's not a lead you lost — that's a lead you never knew existed. Voicemail worked in 2005. In 2026 people expect an answer, not a beep. The businesses that pick up get the job. The ones that don't... someone else does.",
        "chunk_type": "qa",
    },
    {
        "content": "When the caller realizes this demo call IS the product — that's the moment. They're not watching a video or reading a website. They're literally talking to their future receptionist right now. The voice, the personality, the way it handles questions — this is it. That's what makes unmissed different from every other AI phone service. You don't have to imagine what it sounds like. You're hearing it.",
        "chunk_type": "fact",
    },

    # ── Industry-specific pain (barbers, salons, property, realtors, busy pros) ──
    {
        "content": "Q: How does this work for a barber shop or hair salon?\nA: You're mid-haircut, hands full of scissors and product, phone's ringing on the counter. You can't answer. And that caller? They wanted to book a $40 cut for this Saturday. But they hung up and texted the shop down the street instead. With unmissed, the AI picks up, books them into your calendar, and you don't even have to put down the clippers. You find out when your phone buzzes with a text saying 'new booking confirmed for Saturday 2pm.'",
        "chunk_type": "qa",
    },
    {
        "content": "Q: What about nail salons?\nA: Same idea — you're doing someone's nails, both hands are literally occupied, and the phone is ringing. Your regular client wants to rebook. But nobody answers, so she tries someone new. That's a customer you might never get back. The AI answers, knows your services, checks your availability, books the appointment, and texts her a confirmation. You finish the set you're working on, look at your phone, and there's a new booking. No interruption, no lost client.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: I'm a property manager — how does this help me?\nA: Tenants call at the worst times — 11pm pipe burst, Sunday morning heating issue, random billing questions during your busiest day. You can't answer every call. But tenants need to feel heard or they escalate. The AI picks up, figures out if it's an emergency or just a question, collects the details, and alerts you right away. For emergency stuff it tells them to call 911 if needed and flags it urgent. For rental inquiries it captures what they're looking for and you follow up when you're ready. You stop being a 24/7 on-call answering machine.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: I'm a realtor — I miss calls when I'm showing houses.\nA: That's the number one problem for real estate agents. You're at a showing, driving between listings, or in a meeting — and a hot buyer calls. If you miss that call, they call the next agent on their list. You might've just lost a $5000 commission because you were doing your job. The AI picks up, sounds professional, takes their info — what are they looking for, what's their budget, when do they want to view — and texts you the details the second the call ends. You call them back in 5 minutes with all the context. They think you're on top of it. Because you are.",
        "chunk_type": "qa",
    },
    {
        "content": "Q: I'm always busy — do I really need to deal with phone setup?\nA: That's the whole point — you don't. You focus on your business. We handle the phones. Setup is 5 minutes online or we do it for you. After that you literally don't have to think about it. Your phone rings, the AI answers, you get a text alert. That's it. No app to check, no system to learn, no settings to manage. You do your thing, we catch your calls. The alerts come right to your regular text messages and Telegram — same apps you already use.",
        "chunk_type": "qa",
    },

    # ── Alerts and notifications deeper ──
    {
        "content": "Q: How fast do I actually get notified?\nA: Instantly. The second the call ends you get a text message and a Telegram notification on your phone. Not an email buried in your inbox — a text, right there on your lock screen. It tells you who called, what they wanted, and whether they're hot, warm, or cold. Open rates on text are over 90 percent — most people read them within 3 minutes. Email? People check that maybe twice a day. By the time you see an email about a hot lead, they already booked with someone else.",
        "chunk_type": "qa",
    },
]

def embed(text):
    """Get 1536-dim embedding from OpenAI."""
    r = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json={"model": "text-embedding-3-small", "input": text}
    )
    if r.status_code != 200:
        print(f"  Embedding error: {r.status_code} {r.text[:200]}")
        return None
    data = r.json()
    return data["data"][0]["embedding"]

def insert_chunk(chunk):
    emb = embed(chunk["content"])
    if not emb:
        return False

    row = {
        "client_id": CLIENT_ID,
        "content": chunk["content"],
        "chunk_type": chunk["chunk_type"],
        "source": SOURCE,
        "source_run_id": SOURCE_RUN_ID,
        "metadata": json.dumps({}),
        "embedding": json.dumps(emb),
        "status": "approved",
        "trust_tier": "high",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/knowledge_chunks",
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=row,
    )
    if r.status_code not in (200, 201):
        print(f"  Insert error: {r.status_code} {r.text[:200]}")
        return False
    return True

if __name__ == "__main__":
    print(f"Seeding {len(CHUNKS)} knowledge chunks for unmissed-demo...")
    print(f"Run ID: {SOURCE_RUN_ID}")
    stored = 0
    failed = 0
    for i, chunk in enumerate(CHUNKS, 1):
        preview = chunk["content"][:80].replace("\n", " ")
        print(f"  [{i}/{len(CHUNKS)}] {preview}...")
        if insert_chunk(chunk):
            stored += 1
            print(f"    OK")
        else:
            failed += 1
            print(f"    FAILED")
    print(f"\nDone. Stored: {stored}, Failed: {failed}")
