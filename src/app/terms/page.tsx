import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: `Terms of Service — ${BRAND_NAME}`,
  description:
    `Terms and conditions for using the ${BRAND_NAME} AI voice agent platform. Service agreements, billing, acceptable use, and more.`,
  openGraph: {
    title: `Terms of Service — ${BRAND_NAME}`,
    description:
      `Terms and conditions for the ${BRAND_NAME} AI voice agent platform.`,
  },
};

export default function TermsPage() {
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
              Terms of Service
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
                  These Terms of Service (&quot;Terms&quot;) govern your use of the {BRAND_NAME}
                  platform and services (&quot;Service&quot;) operated by {BRAND_NAME}
                  (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;). By subscribing to or
                  using the Service, you (&quot;Client,&quot; &quot;you,&quot; or
                  &quot;your&quot;) agree to be bound by these Terms.
                </p>
                <p className="mt-3">
                  If you do not agree to these Terms, do not use the Service.
                </p>
              </div>

              {/* 1 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  1. Service Description
                </h2>
                <p>
                  {BRAND_NAME} provides a done-for-you AI voice agent platform for service
                  businesses. We build, deploy, and manage AI-powered phone agents that answer
                  inbound calls, capture lead information, book appointments, and deliver
                  real-time notifications on your behalf.
                </p>
                <p className="mt-3">
                  The Service includes agent configuration, telephony integration (phone number
                  provisioning and call routing), workflow automation, lead capture to Google
                  Sheets, notification delivery via Telegram or SMS, and ongoing agent
                  optimization.
                </p>
              </div>

              {/* 2 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  2. Account and Billing
                </h2>
                <p className="mb-3">
                  The Service operates on a monthly subscription basis. By subscribing, you
                  agree to the following:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Subscription fees are billed monthly in advance at the rate corresponding to your selected service tier</li>
                  <li>All prices are in Canadian Dollars (CAD) unless otherwise stated</li>
                  <li>There are no per-minute or per-call charges — pricing is flat-rate for each tier</li>
                  <li>We do not charge setup fees for standard onboarding</li>
                  <li>You are responsible for providing accurate billing information and keeping it current</li>
                  <li>Failed payments may result in temporary suspension of your agent until payment is resolved</li>
                </ul>
                <p className="mt-3 text-gray-400">
                  We offer a 30-day money-back guarantee for new clients. If you are not
                  satisfied within the first 30 days, contact us for a full refund.
                </p>
              </div>

              {/* 3 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  3. Acceptable Use
                </h2>
                <p className="mb-3">
                  You agree to use the Service only for lawful business purposes. You may not:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Use the Service for any illegal, fraudulent, or deceptive activity</li>
                  <li>Use the agent to make unsolicited robocalls or spam calls in violation of applicable telemarketing laws (including Canada&apos;s CRTC Unsolicited Telecommunications Rules and the U.S. TCPA)</li>
                  <li>Instruct the agent to misrepresent itself as a human when directly asked, or to impersonate a real individual</li>
                  <li>Use the Service to harass, threaten, or abuse callers</li>
                  <li>Attempt to reverse-engineer, extract, or copy our agent configurations, prompts, or proprietary workflows</li>
                  <li>Resell or sublicense access to the Service without our written consent</li>
                </ul>
                <p className="mt-3 text-gray-400">
                  We reserve the right to suspend or terminate your account if we determine, in
                  our sole discretion, that you have violated these acceptable use terms.
                </p>
              </div>

              {/* 4 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  4. Service Availability
                </h2>
                <p>
                  We strive to maintain high availability of the Service, but we do not
                  guarantee uninterrupted or error-free operation. The Service is provided on
                  a best-effort basis. Factors outside our control — including telephony
                  carrier outages, third-party API downtime, and internet connectivity
                  issues — may temporarily affect service availability.
                </p>
                <p className="mt-3">
                  We will make commercially reasonable efforts to notify you of planned
                  maintenance or known service disruptions in advance. We do not offer
                  contractual uptime SLAs at this time.
                </p>
              </div>

              {/* 5 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  5. Intellectual Property
                </h2>
                <p className="mb-3">The following ownership terms apply:</p>
                <ul className="list-disc list-inside space-y-2 text-gray-400">
                  <li>
                    <span className="text-white font-medium">Our property:</span> The
                    {BRAND_NAME} platform, agent architecture, prompt engineering
                    methodologies, workflow templates, and all related software, branding, and
                    documentation are our proprietary intellectual property
                  </li>
                  <li>
                    <span className="text-white font-medium">Your property:</span> Your
                    business information, caller data captured during agent interactions, call
                    logs stored in your Google Sheet, and any business-specific content you
                    provide for agent configuration remain your property
                  </li>
                  <li>
                    <span className="text-white font-medium">Call data:</span> Lead data
                    captured by your agent is written to your designated Google Sheet. You
                    retain full ownership and access to this data at all times, including after
                    cancellation
                  </li>
                </ul>
              </div>

              {/* 6 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  6. Call Recording Consent
                </h2>
                <p>
                  Our AI agents record calls for the purpose of service delivery, lead
                  capture, and quality improvement. As the business client deploying an
                  {BRAND_NAME} agent, you are responsible for:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400 mt-3">
                  <li>Understanding and complying with call recording consent laws in your jurisdiction and the jurisdictions of your callers</li>
                  <li>Informing us if your jurisdiction requires two-party or all-party consent, so we can configure an appropriate disclosure at the start of each call</li>
                  <li>Displaying any required notices on your website or marketing materials as required by local law</li>
                </ul>
                <p className="mt-3 text-gray-400">
                  We are not responsible for your failure to comply with applicable recording
                  consent laws.
                </p>
              </div>

              {/* 7 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  7. Limitation of Liability
                </h2>
                <p>
                  To the maximum extent permitted by applicable law:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-400 mt-3">
                  <li>
                    The Service is provided &quot;as is&quot; and &quot;as available&quot;
                    without warranties of any kind, whether express or implied, including
                    implied warranties of merchantability, fitness for a particular purpose, or
                    non-infringement
                  </li>
                  <li>
                    We do not guarantee that the AI agent will handle every call perfectly,
                    capture every piece of information accurately, or book every appointment
                    without error. AI systems can make mistakes, and you acknowledge this
                    inherent limitation
                  </li>
                  <li>
                    In no event shall {BRAND_NAME} be liable for any indirect, incidental,
                    special, consequential, or punitive damages, including but not limited to
                    loss of revenue, lost profits, lost business, or loss of data
                  </li>
                  <li>
                    Our total cumulative liability for any claims arising out of or related to
                    the Service shall not exceed the total fees paid by you in the three (3)
                    months preceding the event giving rise to the claim
                  </li>
                </ul>
              </div>

              {/* 8 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  8. Indemnification
                </h2>
                <p>
                  You agree to indemnify and hold harmless {BRAND_NAME}, its founders,
                  employees, and contractors from any claims, damages, losses, or expenses
                  (including reasonable legal fees) arising from your use of the Service, your
                  violation of these Terms, or your failure to comply with applicable laws
                  (including call recording consent and telemarketing regulations).
                </p>
              </div>

              {/* 9 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  9. Termination
                </h2>
                <p className="mb-3">
                  Either party may terminate the subscription:
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>
                    <span className="text-white font-medium">You</span> may cancel your
                    subscription at any time with 30 days&apos; written notice. Your agent will
                    remain active through the end of the current billing period
                  </li>
                  <li>
                    <span className="text-white font-medium">We</span> may terminate your
                    account immediately if you violate these Terms, fail to pay fees after
                    reasonable notice, or engage in conduct that harms our platform or
                    reputation
                  </li>
                </ul>
                <p className="mt-3">
                  Upon termination, we will deactivate your AI agent and release the
                  associated phone number. Your call log data in your Google Sheet remains
                  yours — we do not delete or restrict access to it.
                </p>
              </div>

              {/* 10 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  10. Modifications to Terms
                </h2>
                <p>
                  We may update these Terms from time to time. When we make material changes,
                  we will notify active clients by email at least 30 days before the changes
                  take effect. Continued use of the Service after the effective date
                  constitutes acceptance of the revised Terms.
                </p>
              </div>

              {/* 11 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  11. Governing Law and Dispute Resolution
                </h2>
                <p>
                  These Terms are governed by and construed in accordance with the laws of the
                  Province of Alberta, Canada, without regard to its conflict of laws
                  principles. Any disputes arising out of or relating to these Terms or the
                  Service shall be resolved in the courts of competent jurisdiction located in
                  Alberta, Canada.
                </p>
              </div>

              {/* 12 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  12. Severability
                </h2>
                <p>
                  If any provision of these Terms is found to be unenforceable or invalid by a
                  court of competent jurisdiction, that provision shall be limited or
                  eliminated to the minimum extent necessary, and the remaining provisions
                  shall remain in full force and effect.
                </p>
              </div>

              {/* 13 */}
              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  13. Contact Us
                </h2>
                <p>
                  If you have questions about these Terms of Service, contact us at:
                </p>
                <div
                  className="mt-4 p-4 rounded-xl"
                  style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" }}
                >
                  <p className="text-white font-semibold">{BRAND_NAME}</p>
                  <p className="text-gray-400 mt-1">
                    Email:{" "}
                    <a
                      href={`mailto:${SUPPORT_EMAIL}`}
                      className="hover:text-white transition-colors"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {SUPPORT_EMAIL}
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
