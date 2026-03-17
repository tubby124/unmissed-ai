"use client";

import { motion, AnimatePresence } from "motion/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OnboardingData } from "@/types/onboarding";
import VoicePicker from "@/components/onboard/VoicePicker";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const MESSAGE_RECIPIENT_OPTIONS = [
  { value: "owner",       label: "The owner", desc: "Messages go directly to you" },
  { value: "front_desk",  label: "Front desk / receptionist", desc: "Messages go to your front office" },
  { value: "custom",      label: "Someone specific", desc: "Enter the person's name below" },
];

const AGENT_BEHAVIOR_OPTIONS = [
  {
    value: "message_only",
    label: "Just take a message",
    desc: "Name, phone number, brief reason — nothing more",
  },
  {
    value: "message_and_faq",
    label: "Take a message + answer basic questions",
    desc: "Also answers hours, location, and simple FAQs before taking the message",
  },
];

export default function VoicemailNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const recipient = (answers.messageRecipient as string) || "owner";
  const customRecipient = (answers.customRecipient as string) || "";
  const behavior = (answers.voicemailBehavior as string) || "message_only";
  const extraContext = (answers.voicemailContext as string) || "";
  const selectedVoiceId = (answers.voiceId as string) || null;

  return (
    <div className="space-y-6">
      {/* Voice selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Pick a voice for your agent</Label>
        <p className="text-xs text-slate-500 -mt-1">Click the play button to preview, then click to select. You can change this anytime in your dashboard.</p>
        <VoicePicker
          selectedVoiceId={selectedVoiceId}
          onSelect={(voiceId) => onChange("voiceId", voiceId)}
        />
      </div>

      {/* Who receives messages */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Who should messages go to?</Label>
        <div className="space-y-2">
          {MESSAGE_RECIPIENT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`
                flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${recipient === opt.value
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="messageRecipient"
                value={opt.value}
                checked={recipient === opt.value}
                onChange={() => onChange("messageRecipient", opt.value)}
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
          {recipient === "custom" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="space-y-1.5">
                <Label htmlFor="customRecipient">Their name or title</Label>
                <Input
                  id="customRecipient"
                  placeholder="e.g. Sarah, dispatch team, our manager Mike"
                  value={customRecipient}
                  onChange={(e) => onChange("customRecipient", e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Agent behavior */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">What should the agent do on each call?</Label>
        <div className="space-y-2">
          {AGENT_BEHAVIOR_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`
                flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all
                ${behavior === opt.value
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
                }
              `}
            >
              <input
                type="radio"
                name="voicemailBehavior"
                value={opt.value}
                checked={behavior === opt.value}
                onChange={() => onChange("voicemailBehavior", opt.value)}
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

      {/* Extra context — optional */}
      <div className="space-y-2">
        <Label htmlFor="voicemailContext">
          Anything specific the agent should mention?{" "}
          <span className="text-slate-400 font-normal text-xs">(optional)</span>
        </Label>
        <Textarea
          id="voicemailContext"
          placeholder="e.g. We're closed on holidays. Urgent matters can reach us at our emergency line."
          value={extraContext}
          onChange={(e) => onChange("voicemailContext", e.target.value)}
          className="resize-none min-h-[80px]"
        />
        <p className="text-xs text-slate-400">
          Leave blank and your agent will use smart defaults based on your business info.
        </p>
      </div>
    </div>
  );
}
