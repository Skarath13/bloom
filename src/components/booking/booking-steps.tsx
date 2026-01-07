"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  name: string;
  shortName: string;
}

const steps: Step[] = [
  { id: 1, name: "Location", shortName: "Location" },
  { id: 2, name: "Service", shortName: "Service" },
  { id: 3, name: "Technician", shortName: "Tech" },
  { id: 4, name: "Date & Time", shortName: "Time" },
  { id: 5, name: "Checkout", shortName: "Pay" },
];

interface BookingStepsProps {
  currentStep: number;
}

export function BookingSteps({ currentStep }: BookingStepsProps) {
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;
  const currentStepName = steps.find((s) => s.id === currentStep)?.name || "";

  return (
    <nav aria-label="Progress">
      {/* Mobile: Simple progress bar */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">
            {currentStepName}
          </span>
          <span className="text-xs text-muted-foreground">
            Step {currentStep} of {steps.length}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${Math.max(progress, 10)}%` }}
          />
        </div>
      </div>

      {/* Desktop: Full step indicator */}
      <ol className="hidden md:flex items-center justify-center">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              "flex items-center",
              index !== steps.length - 1 && "flex-1"
            )}
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  step.id < currentStep
                    ? "bg-primary text-primary-foreground"
                    : step.id === currentStep
                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step.id < currentStep ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 text-[10px] font-medium",
                  step.id <= currentStep
                    ? "text-primary"
                    : "text-muted-foreground"
                )}
              >
                {step.shortName}
              </span>
            </div>
            {index !== steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-full min-w-[1.5rem] mx-1.5",
                  step.id < currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
