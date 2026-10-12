'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CreditCard,
  MoreHorizontal,
  X,
  ChevronRight,
  Sparkles,
  Pill,
  HeartHandshake,
  Calendar,
  FileText,
  Building2,
  ShieldAlert,
  UserCog,
  MessageSquare,
  BarChart3,
  Sliders,
  LogOut,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { canAccessModule } from '@calyvia/shared';
import { NAVIGATION_STRUCTURE } from './Sidebar';

interface BottomNavProps {
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
  onOpenAiAssistant?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentModule,
  onSelectModule,
  onOpenAiAssistant,
}) => {
  const { user, logout } = useAuth();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // 4 Primary core routes for quick-access bottom bar
  const primaryTabs: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'clinical', label: 'Clinical', icon: Stethoscope },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ];

  // Helper to determine if a primary tab is active (including its submodules)
  const isTabActive = (tabId: string): boolean => {
    if (currentModule === tabId) return true;
    if (tabId === 'patients' && currentModule === 'family') return true;
    if (tabId === 'clinical' && (currentModule === 'detox' || currentModule === 'appointments')) return true;
    return false;
  };

  const handleSelect = (moduleId: string) => {
    onSelectModule(moduleId);
    setIsMoreOpen(false);
  };

  // Filter allowed modules from full navigation structure for the More drawer
  const allowedSections = NAVIGATION_STRUCTURE.map((sec) => {
    const modules = sec.modules
      .map((mod) => {
        if (mod.submodules && mod.submodules.length > 0) {
          const allowedSub = mod.submodules.filter((sub) => canAccessModule(user?.role, sub.id));
          if (allowedSub.length === 0) return null;
          return { ...mod, submodules: allowedSub };
        }
        if (!canAccessModule(user?.role, mod.id)) return null;
        return mod;
      })
      .filter((m) => m !== null);

    return { category: sec.category, modules };
  }).filter((s) => s.modules.length > 0);

  return (
    <>
      {/* Persistent Bottom Bar for Mobile & Tablet (hidden on desktop md:hidden) */}
      <nav
        aria-label="Mobile and tablet primary navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border shadow-elevated pb-safe md:hidden select-none transition-all duration-200"
      >
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isTabActive(tab.id);

            return (
              <button
                key={tab.id}
                onClick={() => handleSelect(tab.id)}
                className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-all duration-150 min-h-[44px] min-w-[44px] touch-manipulation cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden ${
                  active
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground active:scale-95'
                }`}
                aria-current={active ? 'page' : undefined}
                aria-label={tab.label}
              >
                {/* Active indicator pill */}
                {active && (
                  <span className="absolute top-1.5 w-8 h-1 rounded-full bg-primary animate-fade-in" />
                )}
                <div
                  className={`p-1 rounded-xl transition-colors duration-150 ${
                    active ? 'bg-primary-soft' : ''
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="leading-tight mt-0.5 truncate max-w-[64px]">{tab.label}</span>
              </button>
            );
          })}

          {/* More Modules Toggle Button */}
          <button
            onClick={() => setIsMoreOpen(true)}
            className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 text-[10px] font-semibold transition-all duration-150 min-h-[44px] min-w-[44px] touch-manipulation cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden ${
              isMoreOpen ||
              (!primaryTabs.some((t) => isTabActive(t.id)) && currentModule !== '')
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground active:scale-95'
            }`}
            aria-label="More navigation modules"
          >
            {(!primaryTabs.some((t) => isTabActive(t.id)) && currentModule !== '') && (
              <span className="absolute top-1.5 w-8 h-1 rounded-full bg-primary animate-fade-in" />
            )}
            <div
              className={`p-1 rounded-xl transition-colors duration-150 ${
                isMoreOpen || (!primaryTabs.some((t) => isTabActive(t.id)) && currentModule !== '')
                  ? 'bg-primary-soft'
                  : ''
              }`}
            >
              <MoreHorizontal className="w-5 h-5" />
            </div>
            <span className="leading-tight mt-0.5">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-over Sheet / Drawer for "More" Modules */}
      {isMoreOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsMoreOpen(false)}
            aria-hidden="true"
          />

          {/* Sheet Container */}
          <div className="relative z-10 w-full bg-surface border-t border-border rounded-t-3xl shadow-2xl max-h-[82vh] flex flex-col animate-in slide-in-from-bottom duration-250 pb-safe">
            {/* Header / Grab Bar */}
            <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-soft border border-primary/20 flex items-center justify-center text-primary">
                  <MoreHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-serif text-sm font-bold text-foreground">
                    All Calyvia Modules
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Access all 15 operational areas & settings
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Ribbon inside Sheet */}
            {onOpenAiAssistant && (
              <div className="px-4 py-3 bg-surface-subtle border-b border-border flex items-center justify-between">
                <div className="flex items-center space-x-2 text-xs">
                  <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">Calyvia AI Copilot</div>
                    <div className="text-[10px] text-muted-foreground">Live Clinical Assistant</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setIsMoreOpen(false);
                    onOpenAiAssistant();
                  }}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover transition shadow-xs"
                >
                  Launch
                </button>
              </div>
            )}

            {/* Scrollable list of modules categorized */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {allowedSections.map((sec) => (
                <div key={sec.category} className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase px-2 font-mono">
                    {sec.category}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {sec.modules.map((mod: any) => {
                      const Icon = mod.icon;
                      const isModActive = currentModule === mod.id;

                      return (
                        <div key={mod.id} className="space-y-1">
                          <button
                            onClick={() => handleSelect(mod.id)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left min-h-[44px] ${
                              isModActive
                                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                : 'text-foreground hover:bg-surface-elevated active:bg-surface-subtle'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate">
                              <Icon className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{mod.name}</span>
                            </div>
                            <ChevronRight
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isModActive ? 'text-primary-foreground' : 'text-muted-foreground'
                              }`}
                            />
                          </button>

                          {/* Submodules rendering */}
                          {mod.submodules && mod.submodules.length > 0 && (
                            <div className="pl-6 pr-2 py-0.5 space-y-1">
                              {mod.submodules.map((sub: any) => {
                                const isSubActive = currentModule === sub.id;
                                return (
                                  <button
                                    key={sub.id}
                                    onClick={() => handleSelect(sub.id)}
                                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[11px] transition min-h-[36px] ${
                                      isSubActive
                                        ? 'bg-primary-soft text-primary font-semibold'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-surface-subtle'
                                    }`}
                                  >
                                    <span className="truncate">{sub.name}</span>
                                    {isSubActive && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Logout footer */}
            <div className="p-4 border-t border-border bg-surface-subtle">
              <button
                onClick={async () => {
                  setIsMoreOpen(false);
                  await logout();
                }}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl border border-danger/20 text-danger hover:bg-danger-soft text-xs font-semibold transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Calyvia</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
