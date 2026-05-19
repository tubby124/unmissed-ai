# End Voicemail Carrier Forwarding Proof Matrix

Date: 2026-05-19

Purpose: identify the carrier/device failure modes that can stop End Voicemail from replacing missed-call voicemail, and define the live tests Hasan/operator must run before using carrier claims in ads or onboarding copy.

## Launch Position

Do not claim "works on every carrier" until the real matrix is tested. The truthful launch promise is:

> Forward missed calls from your normal business number to your AI number, then prove it by calling your normal business number from another phone and confirming the captured call plus owner summary.

The product can provide codes and troubleshooting, but the proof is the real phone path.

## Universal Test Recipe

For every carrier/device combination:

1. Confirm the customer's normal business number can receive a regular inbound call.
2. Confirm the AI/Twilio number answers if called directly.
3. Disable or bypass carrier voicemail where required.
4. Turn off iPhone Live Voicemail for iOS users before testing conditional forwarding.
5. Activate conditional forwarding for:
   - no answer
   - busy/decline
   - unreachable/offline, if supported
6. Call the normal business number from a different phone.
7. Let it ring out without answering.
8. Confirm the AI answers, call log is created, final classification is HOT/WARM/COLD, email summary is sent, and optional Telegram arrives if configured.
9. Repeat with:
   - phone busy/on another call
   - phone off/airplane mode
   - do-not-disturb/focus mode if the owner uses it
10. Record evidence: carrier, plan type, phone model, OS, exact codes, exact confirmation text/audio, pass/fail, failure mode, workaround.

## Matrix

| Carrier / line type | Docs-backed setup | Codes / setup path | Known blockers | Required live tests |
|---|---|---|---|---|
| Rogers Wireless | Rogers says conditional forwarding will not work when voicemail is activated. | No answer `*61*[10-digit]#`; busy `*67*[10-digit]#`; unreachable `*62*[10-digit]#`; status via `*#61#`, `*#67#`, `*#62#`; cancel via `##61#`, `##67#`, `##62#`. | Carrier voicemail must be removed/disabled, not merely ignored. Long-distance or Canada/US destination restrictions may apply. | No-answer, busy/decline, phone off. Confirm voicemail does not capture first. |
| Fido Wireless | Fido says conditional forwarding is only offered when the user is not subscribed to voicemail; it also notes Canada/US forwarding and billing constraints. | Fido lists unreachable `*62*[10 digits]#`, no-reply `*61*[10 digits]#`, busy `*67*[10 digits]#`; deactivation shown as `##62#`, `##61#`, `##67#`. | Same Rogers-family voicemail conflict. Pay-per-use/add-on billing can surprise customers. | Same as Rogers plus billing/add-on confirmation. |
| Bell Mobility | Bell distinguishes immediate Call Forwarding from No Answer Transfer; No Answer Transfer rings the mobile first, then forwards. Bell says forwarding can be pay-per-use and sends confirmation text when activated. | Prefer device Call Settings > Call Forwarding > unanswered/no-answer type. Bell/TurboHub docs expose GSM-style `*61*`, `*67*`, `*62*` codes, but mobile users may be guided through device settings. | Wrong mode can forward from first ring, making the business owner unable to answer directly. Long-distance/pay-per-use charges. Bell voicemail may need to be disabled for voicemail-replacement behavior. | No-answer transfer first; then busy and unreachable if available on device/plan. Confirm text message and final call path. |
| Virgin Plus | Virgin says Call Forwarding can send incoming calls to another North American number and can forward calls you do not answer. Virgin also notes iOS 17 Live Voicemail can change voicemail behavior and tells users to turn it off. | Device Call Settings path is the official user-facing path. GSM-style codes may work but should be treated as needs-verification for Virgin. | Live Voicemail on iPhone, long-distance charges, and Bell-family voicemail behavior. | iPhone with Live Voicemail off/on comparison, no-answer, busy, phone off. |
| TELUS Mobility | TELUS documentation found in Smart Hub/Business docs supports no-answer, busy, and unreachable forwarding codes. | No answer `*61*[dest]#` or in some docs with delay; busy `*67*[dest]#`; unreachable `*62*[dest]#`. | TELUS community reports show conditional forwarding can fail while unconditional still works, with calls falling to TELUS voicemail. Treat as higher-risk until tested. | No-answer, busy, phone off, and a failure-mode test where carrier voicemail is still enabled. |
| Koodo | Koodo public help confirms call forwarding as an add-on/pay-per-use surface, but its help page is thin in crawled content. Community/source snippets indicate prepaid restrictions and possible VoLTE requirements. | Expected TELUS-family codes: no answer `*61*`, busy `*67*`, unreachable `*62*`; exact prepaid/postpaid behavior must be verified. | Prepaid may not support full forwarding; call-forwarding add-on/pay-per-use may be required; VoLTE/device support may matter. | Separate Koodo postpaid and prepaid tests. Document exact error messages. |
| Public Mobile | Public Mobile likely follows TELUS-family GSM conditional forwarding behavior, but official support proof was not strong enough in this research pass. | Expected: no answer `*61*`, busy `*67*`, unreachable `*62*`; treat as unverified. | Plan/support ambiguity. Prepaid behavior must be live-tested before any claim. | Public Mobile live SIM test required before launch copy names it. |
| Freedom Mobile | Freedom publishes dialer codes for all four versions and says forwarding redirects to another Canadian phone number. | Unconditional `*21*[10-digit]#`; no reply `*61*[10-digit]#`; not reachable `*62*[10-digit]#`; busy `*67*[10-digit]#`; disable with matching `#21#`, `#61#`, `#62#`, `#67#`. | Destination must be Canadian per Freedom docs. Device settings may still point scenarios to Freedom voicemail number; users may need to overwrite desired scenarios. | No-answer, busy, phone off; verify Canada destination only and voicemail number replacement. |
| SaskTel Wireless | SaskTel has the clearest official conditional forwarding docs, including status, cancel, resume, all-conditional, and ring-delay syntax. | Universal `*21*[dest]#`; busy `*67*[dest]#`; no answer `*61*[dest]**[sec]#`; unreachable `*62*[dest]#`; all conditional `*004*[dest]#`; status via `*#code#`; cancel/retain `#code#`; cancel/forget `##code#`. | Must subscribe to the feature; no-answer can include a seconds parameter; restoring voicemail uses SaskTel voicemail destination. | Use `*004*` all-conditional and individual-code tests; test 15s and default timing. |
| Rogers / Bell / SaskTel home phone | Landline/home-phone codes can differ from wireless codes. Rogers home phone no-answer forwarding uses `*92` / `*93`, and Rogers notes voicemail subscription can prevent no-answer forwarding from working as expected. SaskTel home phone uses `*90` busy, `*92` don't answer, `*72` universal. | Use carrier home-phone docs, not wireless codes. | Home-phone voicemail packages can occupy the same no-answer behavior. Some lines require the forwarded-to number to answer during activation. | Separate from wireless matrix. Test with the actual landline/home-phone device. |
| RingCentral / 8x8 / VoIP PBX | VoIP providers generally use admin/user portal call-handling rules, not mobile star codes. RingCentral and 8x8 support forwarding missed/unanswered calls to external numbers. | RingCentral: Settings/Admin Portal > Phone > Call handling/forwarding > missed calls. 8x8: Admin Console or Work app > Call Forwarding; rules for busy, no answer, outage, always. | Rules can conflict with business hours, after-hours, queues, auto-attendants, voicemail, licenses, or ring groups. Caller ID and loop prevention can behave differently. | Test business hours, after hours, queue timeout, no-answer, busy, and admin/user permission constraints. |

## Failure Modes To Build Into Support

- Carrier voicemail wins over conditional forwarding.
- iPhone Live Voicemail intercepts unanswered calls before carrier forwarding behaves as expected.
- User enabled unconditional forwarding by mistake, so every call goes to the AI and staff cannot answer live.
- User called the AI number directly and thinks that proves voicemail replacement.
- User tests from the same phone/SIM, which can route to voicemail retrieval or produce misleading behavior.
- No-answer works, but busy/decline does not.
- No-answer works, but phone-off/unreachable falls to carrier voicemail or a fast-busy/reorder tone.
- Carrier accepts the code but keeps the old voicemail deposit number in one condition.
- Prepaid/MVNO plans do not support all conditions or require add-ons.
- Destination number format is wrong: 10 digits vs `1` + 10 digits vs E.164.
- Forwarded destination is treated as long-distance or outside allowed region.
- Wi-Fi calling, VoLTE, roaming, Focus/DND, spam filtering, or device calling-account settings change the observed behavior.
- VoIP PBX rules conflict with after-hours rules, auto-attendants, queues, or voicemail fallback.

## Carrier Support Script

Use this when a customer cannot activate forwarding from the phone:

> I need conditional call forwarding on my business line to send missed calls to my answering service number. Please disable carrier voicemail or remove it from the no-answer/busy/unreachable forwarding slots, then set conditional forwarding for no answer, busy, and unreachable to [AI_NUMBER]. I still need normal inbound calls to ring my phone first.

If support asks for terms:

- No Answer Transfer / Call Forward No Reply
- Call Forward Busy
- Call Forward Unreachable / Not Reachable
- Conditional Call Forwarding
- Do not enable immediate/unconditional forwarding unless the customer wants every call to go to the AI.

## Product Copy Guidance

Use:

- "Most Canadian mobile carriers support missed-call forwarding, but voicemail and plan settings can block it."
- "The final step is a real test from your normal business number."
- "If forwarding fails, we help you ask your carrier to remove voicemail and set no-answer forwarding."

Avoid:

- "Works on every carrier."
- "Five minutes for everyone."
- "Voicemail can stay active."
- "Calling your AI number directly proves setup."

## Sources

- Rogers wireless call forwarding docs: https://www.rogers.com/web/support/wireless/call-forward/1533
- Rogers home phone no-answer forwarding docs: https://www.rogers.com/support/home-phone/forward-calls-when-no-answer
- Fido call forwarding docs: https://www.fido.ca/fr/soutien/mobilite/renvoi-appel
- Bell Mobility call forwarding docs: https://support.bell.ca/Mobility/Rate_plans_features/How_to_use_Call_Forwarding_on_my_mobile_phone?step=2
- Virgin Plus calling features docs: https://www.virginplus.ca/en/support/faq.html?geoResult=failed&province=ON&q=how-to-use-calling-features
- Freedom Mobile call forwarding docs: https://www.freedommobile.ca/en-CA/support/manage-call-forwarding-service?goToHeading=Phone+Settings
- SaskTel wireless call forwarding docs: https://support.sasktel.com/app/answers/detail/a_id/11035/~/using-wireless-call-forward-features
- SaskTel home phone star codes: https://support.sasktel.com/app/answers/detail/a_id/12372/~/star-codes-for-home-phone-features
- Apple voicemail / Live Voicemail docs: https://support.apple.com/guide/iphone/set-up-voicemail-iph3c99490e/ios
- Apple forwarding settings safety docs: https://support.apple.com/en-mide/guide/personal-safety/ips07e9f4def/web
- RingCentral call handling docs: https://support.ringcentral.com/ca/en/ringex/phone/call-handling-forwarding/setting-up-how-incoming-calls-are-handled.html
- 8x8 call forwarding docs: https://docs.8x8.com/8x8WebHelp/8x8-voice-for-microsoft-teams-app-admin/Archive/VOM/VOMSetupCallforward.htm
