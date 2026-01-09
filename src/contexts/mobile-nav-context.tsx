"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface MobileNavContextType {
  isNavHidden: boolean;
  hideNav: () => void;
  showNav: () => void;
}

const MobileNavContext = createContext<MobileNavContextType | undefined>(undefined);

export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [isNavHidden, setIsNavHidden] = useState(false);

  return (
    <MobileNavContext.Provider
      value={{
        isNavHidden,
        hideNav: () => setIsNavHidden(true),
        showNav: () => setIsNavHidden(false),
      }}
    >
      {children}
    </MobileNavContext.Provider>
  );
}

export function useMobileNav() {
  const context = useContext(MobileNavContext);
  if (!context) {
    throw new Error("useMobileNav must be used within a MobileNavProvider");
  }
  return context;
}
