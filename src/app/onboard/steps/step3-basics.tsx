"use client";

import { OnboardingData } from "@/types/onboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  data: OnboardingData;
  onUpdate: (updates: Partial<OnboardingData>) => void;
}

export default function Step3Basics({ data, onUpdate }: Props) {
  const isVoicemail = data.niche === "voicemail";
  const isRealEstate = data.niche === "real_estate";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Business basics</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Confirm your details so your agent knows who it&apos;s representing.
        </p>
      </div>

      {/* Business Name */}
      <div className="space-y-1.5">
        <Label htmlFor="businessName">Business name <span className="text-red-500">*</span></Label>
        <Input
          id="businessName"
          value={data.businessName}
          onChange={(e) => onUpdate({ businessName: e.target.value })}
          placeholder="Acme Services"
        />
      </div>

      {/* Owner / Contact Name */}
      {isRealEstate && (
        <div className="space-y-1.5">
          <Label htmlFor="ownerName">Your name <span className="text-red-500">*</span></Label>
          <Input
            id="ownerName"
            value={data.ownerName}
            onChange={(e) => onUpdate({ ownerName: e.target.value })}
            placeholder="Jane Smith"
          />
        </div>
      )}

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="callbackPhone">Business phone <span className="text-red-500">*</span></Label>
        <Input
          id="callbackPhone"
          type="tel"
          value={data.callbackPhone}
          onChange={(e) => onUpdate({ callbackPhone: e.target.value })}
          placeholder="(306) 555-1234"
        />
        <p className="text-xs text-muted-foreground">The number callers will be told to call back on.</p>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="contactEmail">Contact email <span className="text-red-500">*</span></Label>
        <Input
          id="contactEmail"
          type="email"
          value={data.contactEmail}
          onChange={(e) => onUpdate({ contactEmail: e.target.value })}
          placeholder="you@business.com"
        />
        <p className="text-xs text-muted-foreground">Used for your dashboard login and notifications.</p>
      </div>

      {/* City — not needed for voicemail */}
      {!isVoicemail && (
        <div className="space-y-1.5">
          <Label htmlFor="city">City <span className="text-red-500">*</span></Label>
          <Input
            id="city"
            value={data.city}
            onChange={(e) => onUpdate({ city: e.target.value })}
            placeholder="Saskatoon"
          />
        </div>
      )}

      {/* Business Hours — not needed for voicemail */}
      {!isVoicemail && (
        <div className="space-y-1.5">
          <Label htmlFor="businessHoursText">Business hours <span className="text-red-500">*</span></Label>
          <Input
            id="businessHoursText"
            value={data.businessHoursText}
            onChange={(e) => onUpdate({ businessHoursText: e.target.value })}
            placeholder="Mon-Fri 9am-5pm, Sat 10am-2pm"
          />
          <p className="text-xs text-muted-foreground">Your agent will tell callers when you&apos;re open.</p>
        </div>
      )}

      {/* Services — optional helper */}
      {!isVoicemail && (
        <div className="space-y-1.5">
          <Label htmlFor="servicesOffered">Services offered <span className="text-muted-foreground/70 font-normal text-xs">(optional)</span></Label>
          <Input
            id="servicesOffered"
            value={data.servicesOffered}
            onChange={(e) => onUpdate({ servicesOffered: e.target.value })}
            placeholder="Windshield repair, chip repair, mobile service"
          />
        </div>
      )}
    </div>
  );
}
