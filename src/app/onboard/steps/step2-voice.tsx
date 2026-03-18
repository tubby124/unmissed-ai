"use client";

import { useEffect } from "react";
import { OnboardingData, defaultAgentNames, Niche } from "@/types/onboarding";
import GenderVoicePicker from "@/components/onboard/GenderVoicePicker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function Step2Voice({ data, onUpdate }: Props) {
  // Auto-select female voice as default if none chosen
  useEffect(() => {
    if (!data.voiceId) {
      onUpdate({ voiceId: 'aa601962-1cbd-4bbd-9d96-3c7a93c3414a', voiceName: 'Jacqueline' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill agent name from niche default if not yet set
  useEffect(() => {
    if (!data.agentName && data.niche) {
      const defaultName = defaultAgentNames[data.niche as Niche];
      if (defaultName) {
        onUpdate({ agentName: defaultName });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestedName = data.niche ? defaultAgentNames[data.niche as Niche] : "Sam";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Choose your agent&apos;s voice</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a voice that matches your brand. You can change it anytime.
        </p>
      </div>

      <GenderVoicePicker
        selectedVoiceId={data.voiceId}
        onSelect={(id, name) => onUpdate({ voiceId: id, voiceName: name })}
      />

      <div className="space-y-2 pt-2 border-t border-border">
        <Label htmlFor="agentName" className="flex items-center gap-1.5">
          Agent name
          <svg className="w-3.5 h-3.5 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </Label>
        <Input
          id="agentName"
          placeholder={suggestedName}
          value={data.agentName}
          onChange={(e) => onUpdate({ agentName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground/70">
          Callers will hear: &quot;Hi, you&apos;ve reached {data.agentName || suggestedName} from [your business]&quot;
        </p>
      </div>
    </div>
  );
}
