"use client";

import { useState } from "react";
import { HELLO_EMAIL } from "@/lib/brand";

const N8N_WEBHOOK_URL = process.env.NEXT_PUBLIC_EMAIL_CAPTURE_WEBHOOK || "";

export default function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");

    try {
      if (N8N_WEBHOOK_URL) {
        await fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, source: "homepage-lead-magnet" }),
        });
      }
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section
      className="py-20 px-4"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      <div className="max-w-xl mx-auto text-center">
        <p
          className="text-xs font-mono uppercase tracking-widest mb-2"
          style={{ color: "var(--color-primary)" }}
        >
          Stay in the Loop
        </p>
        <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: "var(--color-text-1)" }}>
          Not ready to commit?
        </h2>
        <p className="mb-2" style={{ color: "var(--color-text-2)" }}>
          Get actionable tips on capturing more leads — plus early access to new features.
        </p>
        <p
          className="font-semibold text-lg mb-6 leading-tight"
          style={{ color: "var(--color-text-1)" }}
        >
          Join service business owners who never miss a call.
        </p>

        {status === "success" ? (
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: "#0D1F0D", border: "1px solid #166534" }}
          >
            <p className="text-2xl mb-2">✅</p>
            <p className="text-green-400 font-semibold">You&apos;re in!</p>
            <p className="text-sm mt-1" style={{ color: "var(--color-text-2)" }}>
              Thanks! We&apos;ll be in touch with tips to stop missing calls.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none transition-colors"
              style={{
                backgroundColor: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text-1)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-primary)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--color-border)")
              }
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="flex-shrink-0 px-6 py-3 rounded-xl text-white font-semibold text-sm transition-colors disabled:opacity-60"
              style={{ backgroundColor: "var(--color-primary)" }}
            >
              {status === "loading" ? "Sending…" : "Get Updates →"}
            </button>
          </form>
        )}

        {status === "error" && (
          <p className="text-red-400 text-xs mt-2">
            Something went wrong. Email us directly: {HELLO_EMAIL}
          </p>
        )}

        <p className="text-xs mt-3" style={{ color: "var(--color-text-3)" }}>
          No spam. Just useful tips and updates. Unsubscribe anytime.
        </p>
      </div>
    </section>
  );
}
