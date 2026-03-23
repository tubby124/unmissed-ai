"use client";

import { useState, KeyboardEvent } from "react";
import { Label } from "@/components/ui/label";
import { OnboardingData } from "@/types/onboarding";

interface Props {
  data: OnboardingData;
  onChange: (key: string, value: string | string[] | boolean) => void;
}

export default function RealEstateNiche({ data, onChange }: Props) {
  const answers = data.nicheAnswers;
  const serviceAreas = (answers.serviceAreas as string[]) || [];
  const pronouns     = (answers.pronouns    as string)    || "he";

  const [areaInput, setAreaInput] = useState("");

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Your AI receptionist</h2>
        <p className="text-sm text-slate-500 mt-1">Two quick things — refine everything else from your dashboard.</p>
      </div>

      {/* Service areas */}
      <div className="space-y-2">
        <Label>
          Where do you work?{" "}
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

      {/* Pronouns */}
      <div className="space-y-2">
        <Label>Your pronouns</Label>
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
    </div>
  );
}
