"use client";

import { useState, KeyboardEvent } from "react";
import { Label } from "@/components/ui/label";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

const SPECIALTIES = [
  { value: "Residential",      label: "Residential" },
  { value: "Commercial",       label: "Commercial" },
  { value: "Land",             label: "Land" },
  { value: "Multifamily",      label: "Multifamily" },
  { value: "Luxury",           label: "Luxury" },
  { value: "Investment",       label: "Investment" },
  { value: "New Construction", label: "New Construction" },
];

export default function RealEstateNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const serviceAreas     = (answers.serviceAreas    as string[]) || [];
  const specialties      = (answers.specialties     as string[]) || [];
  const pronouns         = (answers.pronouns        as string)   || "he";
  const callMode         = (answers.callMode        as string)   || "";
  const messageRecipient = (answers.messageRecipient as string)  || "";
  const customRecipient  = (answers.customRecipient  as string)  || "";
  const customNotes      = (answers.customNotes      as string)  || "";

  const [areaInput, setAreaInput] = useState("");

  const ownerFirst = (data.ownerName || "").split(" ")[0] || "";

  function addArea() {
    const val = areaInput.trim().replace(/,$/, "");
    if (!val || serviceAreas.includes(val)) { setAreaInput(""); return; }
    onChange("serviceAreas", [...serviceAreas, val]);
    setAreaInput("");
  }

  function handleAreaKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addArea();
    }
    if (e.key === "Backspace" && !areaInput && serviceAreas.length > 0) {
      onChange("serviceAreas", serviceAreas.slice(0, -1));
    }
  }

  function removeArea(val: string) {
    onChange("serviceAreas", serviceAreas.filter(a => a !== val));
  }

  function toggleSpecialty(val: string) {
    const updated = specialties.includes(val)
      ? specialties.filter(s => s !== val)
      : [...specialties, val];
    onChange("specialties", updated);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your AI receptionist</h2>
        <p className="text-sm text-slate-500 mt-1">A few quick choices — change anything from your dashboard later.</p>
      </div>

      {/* Service areas — tag-chip input */}
      <div className="space-y-2">
        <Label>
          Where do you work? <span className="text-red-400">*</span>{" "}
          <span className="text-slate-400 font-normal text-xs">Type a city + province, press Enter</span>
        </Label>
        <div className="min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          {serviceAreas.map(area => (
            <span key={area} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs font-medium">
              {area}
              <button type="button" onClick={() => removeArea(area)} className="text-indigo-400 hover:text-indigo-700 leading-none">×</button>
            </span>
          ))}
          <input
            value={areaInput}
            onChange={e => setAreaInput(e.target.value)}
            onKeyDown={handleAreaKey}
            onBlur={addArea}
            placeholder={serviceAreas.length === 0 ? "e.g. Calgary, AB" : "Add more…"}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <p className="text-xs text-slate-400">Format: "Saskatoon, SK" · "Calgary, AB" · "Edmonton, AB"</p>
      </div>

      {/* Specialties — pill multi-select */}
      <div className="space-y-2">
        <Label>
          What do you focus on?{" "}
          <span className="text-slate-400 font-normal text-xs">(optional — skip if you do a bit of everything)</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map(s => {
            const selected = specialties.includes(s.value);
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => toggleSpecialty(s.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  selected
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pronouns */}
      <div className="space-y-2">
        <Label>Agent&apos;s pronouns <span className="text-red-400">*</span></Label>
        <div className="flex gap-4">
          {[
            { value: "he",   label: "he/him"   },
            { value: "she",  label: "she/her"  },
            { value: "they", label: "they/them" },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="pronouns"
                value={opt.value}
                checked={pronouns === opt.value}
                onChange={() => onChange("pronouns", opt.value)}
                className="accent-indigo-600"
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Call mode — two cards */}
      <div className="space-y-2">
        <Label>What should your agent do? <span className="text-red-400">*</span></Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              value: "message_only",
              title: "Just take a message",
              desc: "Name and reason — fast and simple.",
            },
            {
              value: "message_and_questions",
              title: "Messages + answer basics",
              desc: "Also handles service area questions and showing inquiries.",
            },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange("callMode", opt.value)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                callMode === opt.value
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 hover:border-indigo-200"
              }`}
            >
              <p className={`text-sm font-semibold ${callMode === opt.value ? "text-indigo-800" : "text-slate-700"}`}>
                {opt.title}
              </p>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Message recipient */}
      <div className="space-y-2">
        <Label>Who should your agent pass messages to? <span className="text-red-400">*</span></Label>
        <div className="space-y-2.5">
          {[
            { value: "owner",       label: ownerFirst ? `You (${ownerFirst})` : "You" },
            { value: "front_desk",  label: "The team / front desk" },
            { value: "custom",      label: "Someone else…" },
          ].map(opt => (
            <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="messageRecipient"
                value={opt.value}
                checked={messageRecipient === opt.value}
                onChange={() => onChange("messageRecipient", opt.value)}
                className="accent-indigo-600"
              />
              <span className="text-sm text-slate-700">{opt.label}</span>
            </label>
          ))}
        </div>
        {messageRecipient === "custom" && (
          <input
            type="text"
            placeholder="e.g. Sarah at the front desk"
            value={customRecipient}
            onChange={e => onChange("customRecipient", e.target.value)}
            className="w-full mt-2 h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        )}
      </div>

      {/* Optional custom notes */}
      <div className="space-y-2">
        <Label htmlFor="reCustomNotes">
          Anything else your agent should know?{" "}
          <span className="text-slate-400 font-normal text-xs">(optional)</span>
        </Label>
        <textarea
          id="reCustomNotes"
          rows={3}
          placeholder="e.g. I specialize in acreages near Saskatoon. I work with buyers relocating from out of province."
          value={customNotes}
          onChange={e => onChange("customNotes", e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-slate-400"
        />
      </div>
    </div>
  );
}
