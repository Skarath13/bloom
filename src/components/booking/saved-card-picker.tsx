"use client";

import { useState } from "react";
import { CreditCard, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SavedCard {
  id: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}

interface SavedCardPickerProps {
  cards: SavedCard[];
  selectedId: string | null;
  onSelect: (cardId: string | null) => void;
  onAddNew: () => void;
  disabled?: boolean;
  className?: string;
}

// Brand icons/colors mapping
const brandConfig: Record<string, { color: string; name: string }> = {
  visa: { color: "#1A1F71", name: "Visa" },
  mastercard: { color: "#EB001B", name: "Mastercard" },
  amex: { color: "#006FCF", name: "Amex" },
  discover: { color: "#FF6000", name: "Discover" },
  diners: { color: "#0079BE", name: "Diners" },
  jcb: { color: "#0B4EA2", name: "JCB" },
  unionpay: { color: "#D01F36", name: "UnionPay" },
};

function getBrandInfo(brand: string) {
  const normalized = brand.toLowerCase().replace(/\s/g, "");
  return brandConfig[normalized] || { color: "#6B7280", name: brand };
}

function formatExpiry(month: number, year: number) {
  return `${month.toString().padStart(2, "0")}/${year.toString().slice(-2)}`;
}

export function SavedCardPicker({
  cards,
  selectedId,
  onSelect,
  onAddNew,
  disabled = false,
  className,
}: SavedCardPickerProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleSelectCard = (cardId: string) => {
    if (disabled) return;
    setIsAddingNew(false);
    onSelect(cardId);
  };

  const handleAddNew = () => {
    if (disabled) return;
    setIsAddingNew(true);
    onSelect(null);
    onAddNew();
  };

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-muted-foreground mb-3">
        Select a payment method
      </p>

      {/* Saved cards */}
      {cards.map((card) => {
        const brandInfo = getBrandInfo(card.brand);
        const isSelected = selectedId === card.id && !isAddingNew;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => handleSelectCard(card.id)}
            disabled={disabled}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-input hover:border-primary/50 hover:bg-muted/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {/* Brand indicator */}
            <div
              className="w-10 h-7 rounded flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: brandInfo.color }}
            >
              {brandInfo.name.slice(0, 4).toUpperCase()}
            </div>

            {/* Card details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {brandInfo.name} ending in {card.last4}
                </span>
                {card.isDefault && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Expires {formatExpiry(card.expiryMonth, card.expiryYear)}
              </p>
            </div>

            {/* Selection indicator */}
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                isSelected
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/30"
              )}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
          </button>
        );
      })}

      {/* Add new card option */}
      <button
        type="button"
        onClick={handleAddNew}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
          isAddingNew
            ? "border-primary bg-primary/5 ring-1 ring-primary"
            : "border-dashed border-input hover:border-primary/50 hover:bg-muted/50",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Plus icon */}
        <div className="w-10 h-7 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center">
          <Plus className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Text */}
        <div className="flex-1">
          <span className="font-medium">Add a new card</span>
        </div>

        {/* Selection indicator */}
        <div
          className={cn(
            "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
            isAddingNew
              ? "border-primary bg-primary"
              : "border-muted-foreground/30"
          )}
        >
          {isAddingNew && <Check className="w-3 h-3 text-white" />}
        </div>
      </button>
    </div>
  );
}
