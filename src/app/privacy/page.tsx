import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — unmissed.ai",
  description:
    "How unmissed.ai collects, uses, and protects your data. Our commitment to privacy and security for businesses and their callers.",
  openGraph: {
    title: "Privacy Policy — unmissed.ai",
    description:
      "How unmissed.ai collects, uses, and protects your data.",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />

      <main style={{ backgroundColor: "var(--color-bg)" }}>
        {/* Header */}
        <section className="pt-32 pb-8 px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <p
              className="text-xs font-mono uppercase tracking-widest mb-3"
              style={{ color: "var(--color-primary)" }}
            >
              Legal
            </p>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Privacy Policy
            </h1>
            <p className="text-gray-400 text-lg">
              Last updated: March 1, 2026
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="pb-20 px-4">
          <div
            className="max-w-3xl mx-auto rounded-2xl p-8 md:p-12"
            style={{ backgroundColor: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <div className="space-y-10 text-gray-300 text-sm leading-relaxed">
              {/* Intro */}
              <div>
                <p>
                  unmissed.ai (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates an
                  AI voice agent platform that answers phone calls on behalf of service
                  businesses. This Privacy Policy explains how we collect, use, store, and
                  protect information when you use our services or when callers interact with
                  an AI agent we operate on your behalf.
                </p>
                <p className="mt-3">
                  By using unmissed.ai, you agree to the practices described in this policy. If
                  you do not agree, please discontinue use of our services.
                </p>
              </div>

              {/* 1 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  1. Information We Collect
                </h2>
                <p className="mb-3">
                  We collect information in the following categories:
                </p>

                <h3 className="text-white font-semibold mt-4 mb-2">
                  a) Business Client Information
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Business name, contact name, email address, and phone number</li>
                  <li>Billing information processed through our payment provider</li>
                  <li>Business details provided during onboarding (industry, services offered, hours of operation)</li>
                  <li>Custom agent configuration preferences and scripts</li>
                </ul>

                <h3 className="text-white font-semibold mt-4 mb-2">
                  b) Caller Information
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Phone number of incoming or outgoing callers (via caller ID)</li>
                  <li>Information voluntarily provided during the call (name, email, service request details)</li>
                  <li>Call recordings and transcripts generated during agent interactions</li>
                  <li>Call metadata (date, time, duration, call outcome)</li>
                </ul>

                <h3 className="text-white font-semibold mt-4 mb-2">
                  c) Website Visitor Information
                </h3>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Email address if voluntarily submitted through a form</li>
                  <li>Standard web analytics data (pages visited, browser type, referring URL)</li>
                </ul>
              </div>

              {/* 2 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  2. How We Use Information
                </h2>
                <p className="mb-3">We use collected information to:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Provide, operate, and maintain your AI voice agent</li>
                  <li>Capture and deliver lead information to you in real time via Telegram, SMS, or email notifications</li>
                  <li>Log call data to your designated Google Sheet or CRM integration</li>
                  <li>Analyze call transcripts to improve agent performance and accuracy</li>
                  <li>Monitor service quality and troubleshoot technical issues</li>
                  <li>Process billing and manage your account</li>
                  <li>Communicate with you about service updates, onboarding, and support</li>
                </ul>
                <p className="mt-3 text-gray-400">
                  We do not sell, rent, or trade caller information or business client data to
                  third parties for marketing purposes.
                </p>
              </div>

              {/* 3 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  3. Call Recording Disclosure
                </h2>
                <p>
                  Calls handled by unmissed.ai agents are recorded and transcribed. These
                  recordings are used to deliver the service (capturing lead details, booking
                  appointments) and to improve agent quality over time.
                </p>
                <p className="mt-3">
                  As our business client, you are responsible for ensuring compliance with
                  applicable call recording consent laws in your jurisdiction. In one-party
                  consent jurisdictions (including Alberta, Canada), a single party&apos;s
                  consent is sufficient. In two-party or all-party consent jurisdictions,
                  callers must be informed that the call may be recorded. We can configure your
                  agent to include a recording disclosure at the beginning of each call upon
                  request.
                </p>
              </div>

              {/* 4 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  4. Data Storage and Security
                </h2>
                <p>
                  We take reasonable technical and organizational measures to protect the data
                  we process:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400 mt-3">
                  <li>All data is transmitted over encrypted connections (TLS/SSL)</li>
                  <li>Call recordings and transcripts are stored on secure, access-controlled infrastructure</li>
                  <li>Lead data captured during calls is written directly to your Google Sheet or designated system — we do not maintain a separate long-term database of your caller information</li>
                  <li>Access to production systems is restricted to authorized personnel only</li>
                  <li>We use API key authentication and environment-level secrets management for all service integrations</li>
                </ul>
              </div>

              {/* 5 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  5. Third-Party Services
                </h2>
                <p className="mb-3">
                  We use the following third-party services to deliver our platform. Each
                  provider has its own privacy policy governing the data they process:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-400">
                  <li>
                    <span className="text-white font-medium">Twilio</span> — Telephony
                    infrastructure for making and receiving phone calls and SMS messages
                  </li>
                  <li>
                    <span className="text-white font-medium">Ultravox (Fixie AI)</span> — AI
                    voice model that powers real-time agent conversations
                  </li>
                  <li>
                    <span className="text-white font-medium">Google Workspace</span> — Google
                    Sheets for lead data storage and Google Calendar for appointment booking
                  </li>
                  <li>
                    <span className="text-white font-medium">n8n</span> — Workflow automation
                    for connecting call events to your notification and logging systems
                  </li>
                  <li>
                    <span className="text-white font-medium">Telegram / SMS</span> — Real-time
                    lead notifications delivered to your preferred channel
                  </li>
                </ul>
              </div>

              {/* 6 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  6. Data Retention
                </h2>
                <p>
                  We retain data for the following periods:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400 mt-3">
                  <li>
                    <span className="text-white font-medium">Call recordings and transcripts:</span>{" "}
                    Retained for up to 90 days for quality improvement purposes, unless a longer
                    retention period is requested by the business client or required by law
                  </li>
                  <li>
                    <span className="text-white font-medium">Lead data in Google Sheets:</span>{" "}
                    Persists in your own Google Sheet indefinitely — this data belongs to you and
                    remains accessible even after you cancel service
                  </li>
                  <li>
                    <span className="text-white font-medium">Account and billing information:</span>{" "}
                    Retained for the duration of your subscription and for a reasonable period
                    afterward as required for accounting and legal compliance
                  </li>
                  <li>
                    <span className="text-white font-medium">Website analytics:</span>{" "}
                    Aggregated and anonymized; retained indefinitely
                  </li>
                </ul>
              </div>

              {/* 7 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  7. Your Rights
                </h2>
                <p className="mb-3">
                  Depending on your jurisdiction, you may have the following rights regarding
                  your personal information:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>
                    <span className="text-white font-medium">Access:</span> Request a copy of
                    the personal data we hold about you
                  </li>
                  <li>
                    <span className="text-white font-medium">Correction:</span> Request that we
                    correct inaccurate or incomplete information
                  </li>
                  <li>
                    <span className="text-white font-medium">Deletion:</span> Request that we
                    delete your personal data, subject to legal retention requirements
                  </li>
                  <li>
                    <span className="text-white font-medium">Portability:</span> Your lead data
                    lives in your own Google Sheet by default — you always have full access and
                    ownership
                  </li>
                  <li>
                    <span className="text-white font-medium">Withdrawal of consent:</span> You
                    may stop using our services at any time by canceling your subscription
                  </li>
                </ul>
                <p className="mt-3 text-gray-400">
                  If you are a caller who interacted with an unmissed.ai agent and wish to
                  exercise your rights, please contact us at the email below and we will work
                  with the relevant business client to address your request.
                </p>
              </div>

              {/* 8 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  8. Children&apos;s Privacy
                </h2>
                <p>
                  Our services are designed for use by businesses and are not directed at
                  individuals under the age of 18. We do not knowingly collect personal
                  information from minors.
                </p>
              </div>

              {/* 9 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  9. Changes to This Policy
                </h2>
                <p>
                  We may update this Privacy Policy from time to time. When we make material
                  changes, we will notify active business clients by email and update the
                  &quot;Last updated&quot; date at the top of this page. Continued use of the
                  service after changes constitutes acceptance of the revised policy.
                </p>
              </div>

              {/* 10 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  10. Contact Us
                </h2>
                <p>
                  If you have questions about this Privacy Policy or wish to exercise your data
                  rights, contact us at:
                </p>
                <div
                  className="mt-4 p-4 rounded-xl"
                  style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" }}
                >
                  <p className="text-white font-semibold">unmissed.ai</p>
                  <p className="text-gray-400 mt-1">
                    Email:{" "}
                    <a
                      href="mailto:support@unmissed.ai"
                      className="hover:text-white transition-colors"
                      style={{ color: "var(--color-primary)" }}
                    >
                      support@unmissed.ai
                    </a>
                  </p>
                  <p className="text-gray-500 text-xs mt-2">
                    Alberta, Canada
                  </p>
                </div>
              </div>
            </div>

            {/* Back link */}
            <div className="mt-12 pt-8" style={{ borderTop: "1px solid var(--color-border)" }}>
              <Link
                href="/"
                className="text-sm hover:text-white transition-colors"
                style={{ color: "var(--color-primary)" }}
              >
                &larr; Back to home
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
