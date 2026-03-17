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
        <Label htmlFor="agentName">
          Agent name{" "}
          <span className="text-muted-foreground/70 font-normal text-xs">(suggested: {suggestedName})</span>
        </Label>
        <Input
          id="agentName"
          placeholder={suggestedName}
          value={data.agentName}
          onChange={(e) => onUpdate({ agentName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground/70">
          This is the name your agent uses to introduce itself on calls.
        </p>
      </div>
    </div>
  );
}
