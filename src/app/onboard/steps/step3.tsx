"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingData, BusinessHours, AfterHoursBehavior } from "@/types/onboarding";

function countDigits(s: string): number {
  return (s.match(/\d/g) || []).length;
}

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const DAYS: Array<{ key: keyof OnboardingData["hours"]; label: string }> = [
  { key: "monday",    label: "Mon" },
  { key: "tuesday",   label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday",  label: "Thu" },
  { key: "friday",    label: "Fri" },
  { key: "saturday",  label: "Sat" },
  { key: "sunday",    label: "Sun" },
];

const TIME_OPTIONS = [
  "06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30",
  "10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30",
  "14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30",
  "18:00","18:30","19:00","19:30","20:00","20:30","21:00",
];

function formatTime(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`
        relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2
        ${checked ? "bg-indigo-600" : "bg-gray-200"}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5
          ${checked ? "translate-x-4 ml-0.5" : "translate-x-0 ml-0.5"}
        `}
      />
    </button>
  );
}

export default function Step3({ data, onUpdate }: Props) {
  const [emergencyTouched, setEmergencyTouched] = useState(false);

  const updateDay = (day: keyof OnboardingData["hours"], update: Partial<BusinessHours>) => {
    onUpdate({
      hours: {
        ...data.hours,
        [day]: { ...data.hours[day], ...update },
      },
    });
  };

  const emergencyDigits = countDigits(data.emergencyPhone);
  const emergencyInvalid = emergencyTouched && data.emergencyPhone.length > 0 && emergencyDigits < 10;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Business hours</h2>
        <p className="text-sm text-slate-500 mt-1">
          Your agent uses these to answer &quot;Are you open?&quot; questions correctly.
        </p>
      </div>

      {/* Hours grid */}
      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = data.hours[key];
          const isOpen = !day.closed;
          const hasError = isOpen && day.open && day.close && day.close <= day.open;
          return (
            <div key={key} className="flex items-center gap-3 py-1">
              {/* Day label */}
              <div className="w-9 shrink-0">
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </div>

              {/* Open/Closed toggle */}
              <Toggle
                checked={isOpen}
                onChange={() => updateDay(key, { closed: !day.closed })}
              />
              <span className={`text-xs w-10 shrink-0 ${isOpen ? "text-indigo-600 font-medium" : "text-gray-400"}`}>
                {isOpen ? "Open" : "Closed"}
              </span>

              {/* Time selectors */}
              {isOpen && (
                <>
                  <select
                    value={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                    className="h-8 px-2 text-sm rounded-md border border-input bg-background flex-1 cursor-pointer"
                  >
                    <option value="">From</option>
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                  <span className="text-slate-300 text-sm shrink-0">–</span>
                  <select
                    value={day.close}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                    className={`h-8 px-2 text-sm rounded-md border bg-background flex-1 cursor-pointer ${hasError ? "border-red-400" : "border-input"}`}
                  >
                    <option value="">To</option>
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                  {hasError && (
                    <span className="text-xs text-red-500 shrink-0">Fix times</span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* After-hours behavior */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">After hours, your agent should…</Label>
        <div className="space-y-2">
          {[
            {
              value: "take_message" as AfterHoursBehavior,
              label: "Take a message",
              desc: "Ask for name, phone, and reason — you call back",
            },
            {
              value: "route_emergency" as AfterHoursBehavior,
              label: "Route emergencies",
              desc: "Still escalate URGENT calls — everything else takes a message",
            },
            {
              value: "standard" as AfterHoursBehavior,
              label: "Tell them to call back",
              desc: "Standard after-hours — no message taking",
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`
                flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${data.afterHoursBehavior === opt.value
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="afterHours"
                value={opt.value}
                checked={data.afterHoursBehavior === opt.value}
                onChange={() => onUpdate({ afterHoursBehavior: opt.value })}
                className="mt-0.5 accent-indigo-600"
              />
              <div>
                <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Emergency phone — conditionally shown */}
      <AnimatePresence>
        {data.afterHoursBehavior === "route_emergency" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 pt-1">
              <Label htmlFor="emergencyPhone">
                Emergency callback number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="emergencyPhone"
                type="tel"
                placeholder="(403) 555-1234"
                value={data.emergencyPhone}
                onChange={(e) => onUpdate({ emergencyPhone: e.target.value })}
                onBlur={() => setEmergencyTouched(true)}
              />
              {emergencyInvalid && (
                <p className="text-xs text-red-600">Must have at least 10 digits</p>
              )}
              <p className="text-xs text-slate-400">
                Callers flagged as urgent will be given this number after hours
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
