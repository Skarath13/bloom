import { ReactNode } from "react";

export default function BookingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-gradient">
      {/* Header */}
      <header className="py-6 text-center border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <a href="/book" className="inline-flex items-center gap-2">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <span className="text-lg font-bold text-primary-foreground">EL</span>
          </div>
          <div className="text-left">
            <h1 className="text-lg font-bold text-foreground">Elegant Lashes</h1>
            <p className="text-xs text-muted-foreground">by Katie</p>
          </div>
        </a>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t bg-card/50">
        <p>Questions? Text us at 657-334-9919</p>
        <p className="mt-1">Open 9 AM - 7 PM Daily</p>
      </footer>
    </div>
  );
}
