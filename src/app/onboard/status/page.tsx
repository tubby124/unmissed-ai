"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type ProvisionStatus =
  | "pending"
  | "buying_number"
  | "cloning_workflow"
  | "wiring_creds"
  | "active"
  | "failed";

interface StatusResponse {
  jobId: string;
  status: ProvisionStatus;
  twilio_number: string | null;
  error: string | null;
}

const STEPS: Array<{ key: ProvisionStatus; label: string; detail: string }> = [
  { key: "buying_number", label: "Getting your phone number", detail: "Selecting a local number with your area code" },
  { key: "cloning_workflow", label: "Building your agent", detail: "Copying the AI workflow template" },
  { key: "wiring_creds", label: "Connecting everything", detail: "Wiring up your AI, phone, and notification systems" },
  { key: "active", label: "Going live", detail: "Activating your agent and running final checks" },
];

function getStepIndex(status: ProvisionStatus): number {
  // Maps status to the STEPS array index (0-based, matching STEPS)
  const order: ProvisionStatus[] = ["buying_number", "cloning_workflow", "wiring_creds", "active"];
  const idx = order.indexOf(status);
  return idx === -1 ? -1 : idx; // -1 for "pending" (nothing started yet)
}

function StatusContent() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get("jobId");
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [pollingActive, setPollingActive] = useState(true);

  useEffect(() => {
    if (!jobId || !pollingActive) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/provision?jobId=${jobId}`);
        const data: StatusResponse = await res.json();
        setStatus(data);
        if (data.status === "active" || data.status === "failed") {
          setPollingActive(false);
        }
      } catch {
        // ignore transient errors
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [jobId, pollingActive]);

  if (!jobId) {
    return (
      <div className="text-center py-16 text-gray-500">
        Invalid link — no job ID found.
      </div>
    );
  }

  const currentStepIdx = status ? getStepIndex(status.status) : 0;
  const isFailed = status?.status === "failed";
  const isActive = status?.status === "active";

  if (isActive && status?.twilio_number) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-6">
        <div className="text-5xl">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900">Your agent is live!</h1>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 space-y-2">
          <p className="text-sm text-gray-500">Your AI phone number</p>
          <p className="text-3xl font-bold text-blue-700 tracking-wide">
            {status.twilio_number}
          </p>
          <p className="text-sm text-gray-600">Call it right now to test your agent</p>
        </div>

        <div className="text-left bg-white border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-900">Next steps:</p>
          {[
            "Forward your business phone to the number above",
            "Set up Telegram notifications — check your email for instructions",
            "Make a test call to hear your agent in action",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </div>
              <p className="text-sm text-gray-700">{step}</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-400">
          A welcome email with detailed instructions has been sent to you.
        </p>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900">Setup hit a snag</h1>
        <p className="text-sm text-gray-600">
          {status?.error || "Something went wrong during provisioning."}
        </p>
        <p className="text-sm text-gray-500">
          We&apos;ve been notified and will follow up shortly. You can also reach us directly.
        </p>
        <button
          onClick={() => window.history.back()}
          className="text-sm text-blue-600 underline"
        >
          Go back and try again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12 space-y-8">
      <div className="text-center space-y-2">
        <div className="text-4xl animate-pulse">⚙️</div>
        <h1 className="text-xl font-bold text-gray-900">Setting up your agent...</h1>
        <p className="text-sm text-gray-500">This takes about 2 minutes. Don&apos;t close this tab.</p>
      </div>

      <div className="space-y-3">
        {STEPS.map((s, i) => {
          const done = currentStepIdx > i;
          const active = currentStepIdx === i;
          return (
            <div
              key={s.key}
              className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                active ? "bg-blue-50 border border-blue-200" : done ? "opacity-60" : "opacity-30"
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-sm ${
                done ? "bg-green-500 text-white" : active ? "bg-blue-500 text-white animate-pulse" : "bg-gray-200 text-gray-400"
              }`}>
                {done ? "✓" : i + 1}
              </div>
              <div>
                <p className={`text-sm font-medium ${active ? "text-blue-900" : done ? "text-gray-600" : "text-gray-400"}`}>
                  {s.label}
                </p>
                <p className="text-xs text-gray-400">{s.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen text-gray-400">
          Loading...
        </div>
      }>
        <StatusContent />
      </Suspense>
    </div>
  );
}
