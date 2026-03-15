"use client"

import type { OnboardingData } from "@/types/onboarding"

interface Props {
  data: OnboardingData
  onChange: (key: string, value: string | string[] | boolean) => void
}

const CUISINE_TYPES = [
  "Pizza", "Burgers / Fast Food", "Mexican / Tex-Mex", "Asian / Chinese / Thai",
  "Indian / South Asian", "Italian", "Sushi / Japanese", "Mediterranean",
  "BBQ / Smokehouse", "Seafood", "Sandwiches / Deli", "Other",
]

export default function RestaurantStep({ data, onChange }: Props) {
  return (
    <div className="space-y-6">

      {/* Cuisine type */}
      <div className="space-y-2">
        <label className="block text-sm font-medium t1">What type of cuisine do you serve?</label>
        <div className="grid grid-cols-2 gap-2">
          {CUISINE_TYPES.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => onChange("cuisineType", type)}
              className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                data.nicheAnswers.cuisineType === type
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'bg-hover border-white/10 t2 hover:border-white/20'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Order types */}
      <div className="space-y-2">
        <label className="block text-sm font-medium t1">What order types do you offer?</label>
        <div className="grid grid-cols-2 gap-2">
          {["Dine-in", "Takeout", "Delivery", "Catering"].map(type => {
            const current = (data.nicheAnswers.orderTypes as string[]) ?? []
            const selected = current.includes(type)
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  const next = selected ? current.filter(t => t !== type) : [...current, type]
                  onChange("orderTypes", next)
                }}
                className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                  selected
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                    : 'bg-hover border-white/10 t2 hover:border-white/20'
                }`}
              >
                {type}
              </button>
            )
          })}
        </div>
      </div>

      {/* Menu / context data */}
      <div className="space-y-2">
        <label className="block text-sm font-medium t1">
          Menu items <span className="text-xs t3 font-normal">(optional)</span>
        </label>
        <p className="text-xs t3">
          Paste your menu items (name, description, price). Your agent will reference this data to answer menu questions on calls.
        </p>
        <textarea
          value={(data.nicheAnswers.menuData as string) ?? ''}
          onChange={e => onChange("menuData", e.target.value)}
          placeholder={"Pepperoni Pizza - Classic tomato sauce, mozzarella, pepperoni - $18\nMargherita Pizza - Fresh basil, mozzarella, tomato - $16\nCaesar Salad - Romaine, parmesan, croutons - $12"}
          rows={6}
          className="w-full bg-hover border b-theme rounded-xl p-3 text-xs t1 font-mono resize-none focus:outline-none focus:border-blue-500/40 transition-colors leading-relaxed"
          maxLength={8000}
        />
        <p className="text-[10px] t3">{((data.nicheAnswers.menuData as string) ?? '').length.toLocaleString()} / 8,000 chars</p>
      </div>

      {/* Phone ordering */}
      <div className="space-y-2">
        <label className="block text-sm font-medium t1">Do you take phone orders?</label>
        <div className="flex gap-2">
          {[
            { value: "yes", label: "Yes — agent collects order details" },
            { value: "no", label: "No — just answer questions + direct to app/website" },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange("takesPhoneOrders", opt.value)}
              className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                data.nicheAnswers.takesPhoneOrders === opt.value
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'bg-hover border-white/10 t2 hover:border-white/20'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

    </div>
  )
}
