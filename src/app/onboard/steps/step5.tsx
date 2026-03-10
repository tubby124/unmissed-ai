"use client";

import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingData, NotificationMethod } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function Step5({ data, onUpdate }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Notifications</h2>
        <p className="text-sm text-slate-500 mt-1">
          Every call sends you an instant summary — lead score, caller name, what they needed.
        </p>
      </div>

      {/* Owner notifications */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">How should we notify you?</Label>
        <div className="space-y-2 mt-1">
          {[
            {
              value: "telegram" as NotificationMethod,
              label: "Telegram",
              badge: "Recommended",
              desc: "Free, instant, rich formatting — call summary + lead score",
            },
            {
              value: "sms" as NotificationMethod,
              label: "SMS text message",
              badge: "",
              desc: "Text to your phone number",
            },
            {
              value: "both" as NotificationMethod,
              label: "Both Telegram + SMS",
              badge: "",
              desc: "Redundant alerts — never miss a lead",
            },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`
                flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${data.notificationMethod === opt.value
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="notificationMethod"
                value={opt.value}
                checked={data.notificationMethod === opt.value}
                onChange={() => onUpdate({ notificationMethod: opt.value })}
                className="mt-1 accent-indigo-600"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                  {opt.badge && (
                    <span className="px-1.5 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {(data.notificationMethod === "sms" || data.notificationMethod === "both") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="space-y-2">
              <Label htmlFor="notificationPhone">Phone number for SMS alerts</Label>
              <Input
                id="notificationPhone"
                type="tel"
                placeholder="(555) 555-0100"
                value={data.notificationPhone}
                onChange={(e) => onUpdate({ notificationPhone: e.target.value })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {data.notificationMethod === "telegram" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
              <p className="text-sm text-indigo-800 font-medium">Telegram setup (2 min)</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                After your agent is live, we&apos;ll send simple instructions to connect. Just click a link — no technical setup needed.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        <Label htmlFor="notificationEmail">
          Backup email <span className="text-slate-400 font-normal text-xs">(optional)</span>
        </Label>
        <Input
          id="notificationEmail"
          type="email"
          placeholder="owner@yourbusiness.com"
          value={data.notificationEmail}
          onChange={(e) => onUpdate({ notificationEmail: e.target.value })}
        />
      </div>

      {/* Caller follow-up SMS */}
      <div className="space-y-3 pt-2 border-t border-gray-100">
        <div>
          <Label className="text-sm font-medium">Auto-text callers after each call?</Label>
          <p className="text-xs text-slate-400 mt-0.5">
            When your agent captures a caller&apos;s number, send them a quick confirmation text.
          </p>
        </div>
        <div className="space-y-2">
          {[
            {
              value: true,
              label: "Yes — send a follow-up text",
              desc: "\"Thanks for calling [Business]. We'll be in touch shortly.\"",
            },
            {
              value: false,
              label: "No — don't text callers",
              desc: "Only notify me",
            },
          ].map((opt) => (
            <label
              key={String(opt.value)}
              className={`
                flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${data.callerAutoText === opt.value
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="callerAutoText"
                checked={data.callerAutoText === opt.value}
                onChange={() => onUpdate({ callerAutoText: opt.value })}
                className="mt-0.5 accent-indigo-600"
              />
              <div>
                <span className="text-sm font-medium text-slate-900">{opt.label}</span>
                <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        <AnimatePresence>
          {data.callerAutoText && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5">
                <Label htmlFor="callerAutoTextMessage">
                  Custom message{" "}
                  <span className="text-slate-400 font-normal text-xs">(optional — leave blank for default)</span>
                </Label>
                <Input
                  id="callerAutoTextMessage"
                  placeholder="e.g. We got your message! Mike will call you back within the hour."
                  value={data.callerAutoTextMessage}
                  onChange={(e) => onUpdate({ callerAutoTextMessage: e.target.value })}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
