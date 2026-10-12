'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Stethoscope,
  HeartHandshake,
  Calendar,
  Building2,
  CreditCard,
  Pill,
  UserCog,
  FileText,
  ShieldAlert,
  MessageSquare,
  BarChart3,
  Sliders,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  PanelLeftClose,
  PanelLeft,
  Pin,
  LucideIcon,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';
import { useAuth } from './AuthContext';
import { canAccessModule } from '@calyvia/shared';

export interface SubmoduleItem {
  id: string;
  name: string;
}

export interface PrimaryModuleItem {
  id: string;
  name: string;
  icon: LucideIcon;
  submodules?: SubmoduleItem[];
}

export interface NavigationSection {
  category: string;
  modules: PrimaryModuleItem[];
}

export const NAVIGATION_STRUCTURE: NavigationSection[] = [
  {
    category: 'OVERVIEW',
    modules: [
      {
        id: 'dashboard',
        name: 'Management Dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'reports',
        name: 'Reports & Analytics',
        icon: BarChart3,
      },
    ],
  },
  {
    category: 'PATIENT SERVICES',
    modules: [
      {
        id: 'patients',
        name: 'Patients & Family',
        icon: Users,
        submodules: [
          { id: 'patients', name: 'Patient Registry & Profiles' },
          { id: 'family', name: 'Family Management & Contacts' },
        ],
      },
      {
        id: 'crm',
        name: 'Admissions & Referrals',
        icon: UserCheck,
        submodules: [
          { id: 'crm', name: 'CRM & Intake Pipeline' },
          { id: 'referrals', name: 'Referral Partners' },
        ],
      },
      {
        id: 'counselling',
        name: 'Counselling & Therapy',
        icon: HeartHandshake,
      },
      {
        id: 'appointments',
        name: 'Appointments & Calendar',
        icon: Calendar,
      },
      {
        id: 'documents',
        name: 'Documents, Discharge & Aftercare',
        icon: FileText,
        submodules: [
          { id: 'documents', name: 'Digital Forms & Consents' },
          { id: 'discharge', name: 'Discharge Records & Checklist' },
          { id: 'aftercare', name: 'Aftercare & Recovery Cadence' },
        ],
      },
    ],
  },
  {
    category: 'CLINICAL & FACILITY',
    modules: [
      {
        id: 'clinical',
        name: 'Clinical Care & Detox',
        icon: Stethoscope,
        submodules: [
          { id: 'clinical', name: 'Clinical Records & Notes' },
          { id: 'detox', name: 'Detox (CIWA/COWS & Vitals)' },
        ],
      },
      {
        id: 'rooms',
        name: 'Facility & Patient Flow',
        icon: Building2,
        submodules: [
          { id: 'rooms', name: 'Rooms & Bed Allocation' },
          { id: 'movement', name: 'Movement, Leaves & Visitors' },
        ],
      },
      {
        id: 'pharmacy',
        name: 'Pharmacy & Inventory',
        icon: Pill,
        submodules: [
          { id: 'pharmacy', name: 'Pharmacy & e-MAR Chart' },
          { id: 'inventory', name: 'Stores & General Inventory' },
        ],
      },
      {
        id: 'incidents',
        name: 'Incidents & Risk',
        icon: ShieldAlert,
      },
    ],
  },
  {
    category: 'OPERATIONS',
    modules: [
      {
        id: 'billing',
        name: 'Billing & Payments',
        icon: CreditCard,
      },
      {
        id: 'staff',
        name: 'Staff & Tasks',
        icon: UserCog,
        submodules: [
          { id: 'staff', name: 'Staff Profiles & Roster' },
          { id: 'tasks', name: 'Task Management & Handovers' },
        ],
      },
      {
        id: 'communication',
        name: 'Communications & Feedback',
        icon: MessageSquare,
        submodules: [
          { id: 'communication', name: 'SMS & WhatsApp Broadcast' },
          { id: 'feedback', name: 'Patient Feedback & Complaints' },
        ],
      },
    ],
  },
  {
    category: 'SYSTEM',
    modules: [
      {
        id: 'system_admin',
        name: 'Administration & Intelligence',
        icon: Sliders,
        submodules: [
          { id: 'system_admin', name: 'System Settings' },
          { id: 'security', name: 'User Accounts & Security' },
          { id: 'integrations', name: 'Integrations & Webhooks' },
          { id: 'automation', name: 'Workflow Automation' },
          { id: 'ai_extension', name: 'AI Assistant & Intelligence' },
        ],
      },
    ],
  },
];

export interface SidebarProps {
  currentModule: string;
  onSelectModule: (moduleId: string) => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  mobileOpen = false,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { theme } = useTheme();
  const { user, logout } = useAuth();

  // Temporary hover expansion state (Supabase pattern)
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const hoverLeaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  // Detect touch device on mount to avoid unwanted sticky hover states
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(hasTouch);
    }
  }, []);

  // Find parent module of a given subId
  const getParentModuleId = useCallback((subId: string): string => {
    for (const section of NAVIGATION_STRUCTURE) {
      for (const mod of section.modules) {
        if (mod.id === subId) return mod.id;
        if (mod.submodules?.some((sub) => sub.id === subId)) return mod.id;
      }
    }
    return subId;
  }, []);

  const activeParentId = getParentModuleId(currentModule);

  // Expanded parent modules in sidebar accordion
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (activeParentId) {
      initial[activeParentId] = true;
    }
    return initial;
  });

  // Automatically expand parent module whenever currentModule changes
  useEffect(() => {
    if (activeParentId) {
      setExpandedParents((prev) => ({
        ...prev,
        [activeParentId]: true,
      }));
    }
  }, [activeParentId]);

  const toggleParentExpand = (moduleId: string) => {
    setExpandedParents((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  // Filter structure based on role access
  const visibleSections = NAVIGATION_STRUCTURE.map((section) => {
    const modules = section.modules
      .map((mod) => {
        if (mod.submodules && mod.submodules.length > 0) {
          const allowedSubmodules = mod.submodules.filter((sub) =>
            canAccessModule(user?.role, sub.id)
          );
          if (allowedSubmodules.length === 0) return null;
          return {
            ...mod,
            submodules: allowedSubmodules,
          };
        }
        if (!canAccessModule(user?.role, mod.id)) return null;
        return mod;
      })
      .filter((m): m is PrimaryModuleItem => m !== null);

    return {
      category: section.category,
      modules,
    };
  }).filter((section) => section.modules.length > 0);

  const handleSelect = (targetId: string) => {
    onSelectModule(targetId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
      setIsLoggingOut(false);
    }
  };

  // Hover handlers with debounce to prevent jitter / flickering
  const handleMouseEnter = () => {
    if (isTouchDevice) return;
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
    if (isCollapsed) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (isTouchDevice) return;
    if (hoverLeaveTimerRef.current) {
      clearTimeout(hoverLeaveTimerRef.current);
    }
    hoverLeaveTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  // Mobile body scroll lock and escape key handling
  useEffect(() => {
    if (!mobileOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      // Restore focus to header hamburger toggle
      const btn = document.getElementById('calyvia-mobile-menu-btn');
      btn?.focus();
    };
  }, [mobileOpen, onCloseMobile]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (hoverLeaveTimerRef.current) {
        clearTimeout(hoverLeaveTimerRef.current);
      }
    };
  }, []);

  /**
   * Render Sidebar Content
   * @param isDrawer whether this is rendering inside the mobile sliding drawer
   */
  const renderSidebarInner = (isDrawer = false) => {
    // If inside mobile drawer, it is ALWAYS fully expanded.
    // In desktop, it is expanded if not collapsed OR if temporarily hovered.
    const isEffectivelyExpanded = isDrawer || !isCollapsed || isHovered;

    return (
      <div className="h-full flex flex-col bg-surface text-foreground select-none overflow-hidden">
        {/* Brand Header */}
        <div className="h-16 px-3 bg-surface border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => handleSelect('dashboard')}
              title="Calyvia Wellness Center Dashboard"
              aria-label="Calyvia Wellness Center Dashboard"
              className="relative w-10 h-10 flex-shrink-0 bg-primary-soft p-1.5 rounded-xl border border-primary/20 shadow-xs flex items-center justify-center cursor-pointer hover:border-primary/50 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
            >
              <img
                src={theme === 'dark' ? '/brand/calyvia-emblem-dark.svg' : '/brand/calyvia-emblem-light.svg'}
                alt="Calyvia Emblem"
                width={28}
                height={28}
                className="w-7 h-7 object-contain"
              />
            </button>

            {isEffectivelyExpanded && (
              <div className="min-w-0 flex-1 animate-in fade-in-50 duration-150">
                <h1 className="font-serif text-sm font-bold tracking-tight text-foreground leading-tight truncate">
                  Calyvia Wellness
                </h1>
                <p className="text-[10px] text-muted-foreground font-sans truncate">
                  Ruiru, Kenya • HMIS / EMR
                </p>
              </div>
            )}
          </div>

          {/* Desktop Pin / Collapse Header Toggle */}
          {!isDrawer && onToggleCollapse && isEffectivelyExpanded && (
            <button
              type="button"
              onClick={() => {
                onToggleCollapse();
                setIsHovered(false);
              }}
              title={isCollapsed ? 'Pin sidebar expanded' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Pin sidebar expanded' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
              className="hidden md:flex p-1.5 rounded-xl border border-border bg-surface-subtle hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition-all duration-150 flex-shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
            >
              {isCollapsed ? (
                <Pin className="w-4 h-4 text-primary" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Mobile Drawer Close Button */}
          {isDrawer && onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 rounded-xl border border-border text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation Modules List */}
        <nav
          aria-label="Sidebar navigation"
          className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-3 text-xs font-sans scrollbar-thin"
        >
          {visibleSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-1">
              {/* Category Heading (expanded) or Subtle Divider (collapsed) */}
              {isEffectivelyExpanded ? (
                <h2 className="px-3 pt-2 pb-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80 truncate">
                  {section.category}
                </h2>
              ) : (
                sIdx > 0 && (
                  <div
                    className="my-2 mx-1 border-t border-border/60"
                    aria-hidden="true"
                  />
                )
              )}

              {/* Module Items */}
              {section.modules.map((mod) => {
                const Icon = mod.icon;
                const hasSub = mod.submodules && mod.submodules.length > 0;
                const isDirectActive = currentModule === mod.id;
                const isChildActive = mod.submodules?.some((sub) => sub.id === currentModule);
                const isParentActive = isDirectActive || isChildActive;
                const isExpanded = !!expandedParents[mod.id];

                // Collapsed Rail Item (when not effectively expanded)
                if (!isEffectivelyExpanded) {
                  const defaultTarget = mod.submodules ? mod.submodules[0].id : mod.id;
                  return (
                    <div key={mod.id} className="relative group flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleSelect(defaultTarget)}
                        aria-label={mod.name}
                        aria-current={isParentActive ? 'page' : undefined}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden ${
                          isParentActive
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs dark:shadow-[0_2px_12px_-2px_rgba(0,230,118,0.3)]'
                            : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 flex-shrink-0 ${
                            isParentActive ? 'text-primary-foreground' : 'text-muted-foreground/80'
                          }`}
                        />
                      </button>

                      {/* Accessible Hover Tooltip for Collapsed Rail */}
                      <div
                        role="tooltip"
                        aria-hidden="true"
                        className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-surface border border-border shadow-elevated text-xs font-medium text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 flex items-center gap-1.5"
                      >
                        <span>{mod.name}</span>
                        {hasSub && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            ({mod.submodules!.length})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // Expanded Item with full labels and nested submodules accordion
                return (
                  <div key={mod.id} className="space-y-0.5">
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasSub) {
                            if (isParentActive) {
                              toggleParentExpand(mod.id);
                            } else {
                              const defaultTarget = mod.submodules ? mod.submodules[0].id : mod.id;
                              setExpandedParents((prev) => ({ ...prev, [mod.id]: true }));
                              handleSelect(defaultTarget);
                            }
                          } else {
                            handleSelect(mod.id);
                          }
                        }}
                        title={mod.name}
                        aria-label={mod.name}
                        aria-current={isParentActive ? 'page' : undefined}
                        className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 text-left min-h-[40px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden cursor-pointer ${
                          isParentActive
                            ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                            : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <Icon
                            className={`w-4 h-4 flex-shrink-0 ${
                              isParentActive ? 'text-primary' : 'text-muted-foreground/80'
                            }`}
                          />
                          <span className="truncate">{mod.name}</span>
                        </div>
                        {hasSub && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleParentExpand(mod.id);
                            }}
                            className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-muted-foreground/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden cursor-pointer"
                            aria-label={isExpanded ? `Collapse ${mod.name}` : `Expand ${mod.name}`}
                          >
                            <ChevronDown
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-primary' : ''
                              }`}
                            />
                          </button>
                        )}
                      </button>
                    </div>

                    {/* Submenu Items */}
                    {hasSub && isExpanded && (
                      <div className="ml-5 pl-3 border-l border-border/70 space-y-0.5 py-1 animate-in fade-in-50 duration-150">
                        {mod.submodules!.map((sub) => {
                          const isSubActive = currentModule === sub.id;
                          return (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleSelect(sub.id)}
                              aria-current={isSubActive ? 'page' : undefined}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 truncate block min-h-[32px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden cursor-pointer ${
                                isSubActive
                                  ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-elevated'
                              }`}
                            >
                              {sub.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Utility & Account Section */}
        <div className="p-2.5 bg-surface-subtle border-t border-border flex-shrink-0 space-y-1.5">
          {!isEffectivelyExpanded ? (
            /* Collapsed Bottom Controls */
            <div className="space-y-1.5 flex flex-col items-center">
              {onToggleCollapse && (
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleCollapse();
                      setIsHovered(false);
                    }}
                    title="Pin sidebar expanded"
                    aria-label="Pin sidebar expanded"
                    className="w-10 h-10 rounded-xl border border-border bg-surface hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition-all duration-150 flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                  >
                    <PanelLeft className="w-4 h-4 text-primary" />
                  </button>
                  <div
                    role="tooltip"
                    aria-hidden="true"
                    className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-surface border border-border shadow-elevated text-xs font-medium text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
                  >
                    Pin sidebar expanded
                  </div>
                </div>
              )}

              <div className="relative group">
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  title="Sign out"
                  aria-label="Sign out"
                  className="w-10 h-10 rounded-xl border border-border bg-surface hover:bg-danger-soft hover:border-danger/30 text-muted-foreground hover:text-danger active:scale-[0.98] transition-all duration-150 flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-hidden"
                >
                  <LogOut className="w-4 h-4" />
                </button>
                <div
                  role="tooltip"
                  aria-hidden="true"
                  className="absolute left-full ml-3 px-2.5 py-1 rounded-lg bg-surface border border-border shadow-elevated text-xs font-medium text-danger whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50"
                >
                  Sign out
                </div>
              </div>
            </div>
          ) : (
            /* Expanded Bottom Controls */
            <div className="space-y-1.5">
              {!isDrawer && onToggleCollapse && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleCollapse();
                    setIsHovered(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-surface-elevated border border-border/60 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <span className="font-medium">Collapse sidebar</span>
                  <PanelLeftClose className="w-4 h-4 text-muted-foreground" />
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                title="Logout from Calyvia HMIS"
                aria-label="Sign out"
                className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl border border-border bg-surface hover:bg-danger-soft hover:border-danger/30 text-muted-foreground hover:text-danger active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-xs disabled:opacity-50 min-h-[40px] focus-visible:ring-2 focus-visible:ring-danger focus-visible:outline-hidden"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-semibold truncate">
                  {isLoggingOut ? 'Signing out...' : 'Sign out'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* =========================================================================
          DESKTOP / TABLET SIDEBAR (SUPABASE PATTERN)
          Outer <aside> maintains a fixed flex base width in document flow.
          When collapsed, hover temporarily expands the inner container as an overlay,
          preventing the main dashboard content from shifting.
         ========================================================================= */}
      <aside
        role="navigation"
        aria-label="Main Navigation"
        className={`hidden md:flex flex-col flex-shrink-0 relative z-30 transition-[width] duration-200 ease-in-out ${
          isCollapsed ? 'w-[64px]' : 'w-64'
        }`}
      >
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={`h-screen border-r border-border transition-all duration-200 ease-in-out ${
            isCollapsed && isHovered && !isTouchDevice
              ? 'absolute top-0 left-0 w-64 shadow-2xl z-40 bg-surface'
              : isCollapsed
              ? 'w-[64px]'
              : 'w-64'
          }`}
        >
          {renderSidebarInner(false)}
        </div>
      </aside>

      {/* =========================================================================
          MOBILE SLIDING DRAWER (< 768px)
          Hidden by default. Opens on mobile hamburger button with smooth slide-in,
          backdrop blur, touch gestures, escape key, and body scroll locking.
         ========================================================================= */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation Drawer"
        >
          {/* Backdrop with blur */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Sliding Sidebar Drawer */}
          <div className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-200 border-r border-border">
            {renderSidebarInner(true)}
          </div>
        </div>
      )}
    </>
  );
};
