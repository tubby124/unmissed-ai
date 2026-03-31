import { defaultAgentNames, nicheLabels } from "@/types/onboarding";

export function getSampleGreeting(niche: string, businessName: string, agentName: string): string {
  const biz = businessName || "your business";
  if (niche === "voicemail") {
    return `"Hey there, you've reached ${biz}. They can't come to the phone right now, but I can take a message for you."`;
  }
  return `"Hi, thanks for calling ${biz}! This is ${agentName}. How can I help you today?"`;
}

export interface IntakePreview {
  businessName: string;
  niche: string;
  agentName: string;
  voiceId: string;
}

export function AgentPreviewCard({ preview }: { preview: IntakePreview }) {
  const niche = preview.niche || "other";
  const agentName = preview.agentName || defaultAgentNames[niche as keyof typeof defaultAgentNames] || "Sam";
  const businessName = preview.businessName || "Your Business";
  const nicheLabel = nicheLabels[niche as keyof typeof nicheLabels] || niche.replace(/_/g, " ");
  const voiceLabel = preview.voiceId ? "Custom voice selected" : "Auto (based on niche)";
  const greeting = getSampleGreeting(niche, businessName, agentName);

  return (
    <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-5 text-left space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-base shrink-0">
          {agentName[0]}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Your Agent Preview</p>
          <p className="text-xs text-muted-foreground">Here is what your AI receptionist will look like</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <span className="text-muted-foreground">Agent name</span>
        <span className="font-medium text-foreground">{agentName}</span>
        <span className="text-muted-foreground">Business</span>
        <span className="font-medium text-foreground">{businessName}</span>
        <span className="text-muted-foreground">Voice</span>
        <span className="font-medium text-foreground">{voiceLabel}</span>
        <span className="text-muted-foreground">Industry</span>
        <span className="font-medium text-foreground">{nicheLabel}</span>
      </div>

      <div className="bg-background border border-indigo-100 rounded-lg p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1.5">Sample greeting</p>
        <p className="text-sm text-muted-foreground italic leading-relaxed">{greeting}</p>
      </div>
    </div>
  );
}
