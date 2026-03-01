"use client";

import { Label } from "@/components/ui/label";
import { OnboardingData, BusinessHours, AfterHoursBehavior } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

const DAYS: Array<{ key: keyof OnboardingData["hours"]; label: string }> = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
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

export default function Step3({ data, onUpdate }: Props) {
  const updateDay = (day: keyof OnboardingData["hours"], update: Partial<BusinessHours>) => {
    onUpdate({
      hours: {
        ...data.hours,
        [day]: { ...data.hours[day], ...update },
      },
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Business hours</h2>
        <p className="text-sm text-gray-500 mt-1">
          Your agent uses these to answer &quot;Are you open?&quot; questions correctly.
        </p>
      </div>

      <div className="space-y-2">
        {DAYS.map(({ key, label }) => {
          const day = data.hours[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="w-24 shrink-0">
                <span className="text-sm font-medium text-gray-700">{label}</span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={day.closed}
                  onChange={(e) => updateDay(key, { closed: e.target.checked })}
                  className="accent-gray-500"
                />
                <span className="text-xs text-gray-500">Closed</span>
              </label>
              {!day.closed && (
                <>
                  <select
                    value={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                    className="h-8 px-2 text-sm rounded-md border border-input bg-background flex-1"
                  >
                    <option value="">Open time</option>
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                  <span className="text-gray-400 text-sm">–</span>
                  <select
                    value={day.close}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                    className="h-8 px-2 text-sm rounded-md border border-input bg-background flex-1"
                  >
                    <option value="">Close time</option>
                    {TIME_OPTIONS.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">After-hours behavior</Label>
        <div className="space-y-2">
          {[
            { value: "take_message" as AfterHoursBehavior, label: "Take a message — ask for name, phone, reason for call" },
            { value: "route_emergency" as AfterHoursBehavior, label: "Route emergencies — still flag URGENT calls after hours" },
            { value: "standard" as AfterHoursBehavior, label: "Standard message — tell them to call back during business hours" },
          ].map((opt) => (
            <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="afterHours"
                value={opt.value}
                checked={data.afterHoursBehavior === opt.value}
                onChange={() => onUpdate({ afterHoursBehavior: opt.value })}
                className="mt-0.5 accent-blue-600"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
