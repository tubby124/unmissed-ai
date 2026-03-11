"use client";

import { useState, useEffect, useCallback } from "react";

interface InventoryRow {
  id: string;
  phone_number: string;
  twilio_sid: string;
  province: string | null;
  area_code: string | null;
  country: string;
  status: "available" | "reserved" | "assigned";
  assigned_client_id: string | null;
  reserved_intake_id: string | null;
  reserved_at: string | null;
  created_at: string;
  clients: { business_name: string; slug: string } | null;
}

function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return e164;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_STYLES: Record<string, string> = {
  available: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  reserved:  "bg-amber-900/40 text-amber-300 border-amber-700/40",
  assigned:  "bg-blue-900/40 text-blue-300 border-blue-700/40",
};

export default function AdminNumbersPage() {
  const [numbers, setNumbers] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState<string | null>(null); // clientId being unassigned

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/numbers");
      if (!res.ok) return;
      const json = await res.json();
      setNumbers(json.numbers ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNumbers(); }, [fetchNumbers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addInput.trim()) return;
    setAdding(true);
    setAddError(null);
    setAddSuccess(null);
    try {
      const res = await fetch("/api/admin/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: addInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAddError(json.error ?? "Failed to add number");
      } else {
        setAddSuccess(`Added ${formatPhone(json.number.phone_number)} (${json.number.province ?? "unknown province"})`);
        setAddInput("");
        fetchNumbers();
      }
    } catch {
      setAddError("Network error");
    } finally {
      setAdding(false);
    }
  }

  async function handleUnassign(clientId: string, phoneNumber: string) {
    if (!confirm(`Release ${formatPhone(phoneNumber)} from this client and return to inventory?`)) return;
    setUnassigning(clientId);
    try {
      const res = await fetch("/api/admin/unassign-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "Failed to unassign");
      } else {
        fetchNumbers();
      }
    } catch {
      alert("Network error");
    } finally {
      setUnassigning(null);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white">Number Inventory</h1>
        <p className="text-sm text-gray-400 mt-1">
          Pre-owned Twilio numbers offered at $17 CAD during onboarding (vs $20 for a fresh number).
        </p>
      </div>

      {/* Add number form */}
      <div className="bg-gray-900 rounded-xl p-5 border border-white/10">
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Add number to inventory</h2>
        <form onSubmit={handleAdd} className="flex gap-3 items-start">
          <div className="flex-1 space-y-1">
            <input
              type="text"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              placeholder="+14031234567"
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {addError && <p className="text-xs text-red-400">{addError}</p>}
            {addSuccess && <p className="text-xs text-emerald-400">{addSuccess}</p>}
          </div>
          <button
            type="submit"
            disabled={adding || !addInput.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-indigo-600 text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
          >
            {adding ? "Adding…" : "Add to inventory"}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Enter the E.164 number. SID and province are auto-detected from your Twilio account.
        </p>
      </div>

      {/* Inventory table */}
      <div className="bg-gray-900 rounded-xl border border-white/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-200">All inventory numbers</h2>
          <button
            onClick={fetchNumbers}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">Loading…</div>
        ) : numbers.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-500">
            No numbers in inventory yet. Add one above.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-5 py-2.5 text-left font-medium">Number</th>
                <th className="px-3 py-2.5 text-left font-medium">Province</th>
                <th className="px-3 py-2.5 text-left font-medium">Status</th>
                <th className="px-3 py-2.5 text-left font-medium">Assigned to</th>
                <th className="px-3 py-2.5 text-left font-medium">Reserved</th>
                <th className="px-3 py-2.5 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {numbers.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-white/5 last:border-b-0 ${i % 2 === 0 ? "" : "bg-white/[0.02]"}`}
                >
                  <td className="px-5 py-3 font-mono text-white text-xs">
                    {formatPhone(row.phone_number)}
                    <span className="ml-2 text-gray-600 font-sans">{row.twilio_sid.slice(0, 8)}…</span>
                  </td>
                  <td className="px-3 py-3 text-gray-300">{row.province ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLES[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-gray-300">
                    {row.clients ? (
                      <span>{row.clients.business_name}</span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-400 text-xs">
                    {row.reserved_at ? timeAgo(row.reserved_at) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {row.status === "assigned" && row.assigned_client_id && (
                      <button
                        onClick={() => handleUnassign(row.assigned_client_id!, row.phone_number)}
                        disabled={unassigning === row.assigned_client_id}
                        className="text-xs text-red-400 hover:text-red-300 disabled:text-red-900 transition-colors"
                      >
                        {unassigning === row.assigned_client_id ? "Releasing…" : "Unassign"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
