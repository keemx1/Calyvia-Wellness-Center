'use client';

import React, { useState } from 'react';
import { Search, Bell, Sun, Moon, Menu, Settings } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  onSelectModule?: (moduleId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu, onSelectModule }) => {
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState<boolean>(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 bg-surface border-b border-border px-3 sm:px-6 flex items-center justify-between shadow-xs z-20 transition-colors duration-200">
      {/* Left: Mobile Menu Toggle & Search Bar */}
      <div className="flex items-center space-x-2 sm:space-x-4 flex-1 max-w-xl min-w-0">
        {/* Mobile Hamburger Toggle */}
        <button
          id="calyvia-mobile-menu-btn"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl border border-border text-foreground hover:bg-surface-elevated active:scale-95 transition-all flex-shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5 text-foreground" />
        </button>

        {/* Global Search Input with Shortcut (desktop & tablet, or expanded on mobile) */}
        <div
          className={`relative w-full max-w-md ${
            mobileSearchOpen ? 'flex' : 'hidden sm:flex'
          } items-center`}
        >
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search patient, CAL-ID, or record..."
            className="w-full bg-surface-subtle border border-border rounded-xl pl-9 pr-14 py-2 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:flex items-center space-x-0.5">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-surface border border-border rounded shadow-xs">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Small Screen Search Toggle Button */}
        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="sm:hidden p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors flex-shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center"
          aria-label="Toggle search input"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Right: Notifications & Integrated User Profile (with Theme & Settings inside) */}
      <div className="flex items-center space-x-3 text-xs">
        {/* Clinical Alerts / Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            title="Active Clinical Alerts"
            aria-label="Active Clinical Alerts"
            className="w-9 h-9 rounded-xl border border-border bg-surface hover:bg-surface-elevated text-foreground flex items-center justify-center hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 shadow-xs relative cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          >
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full animate-pulse" />
          </button>

          {/* Notifications Dropdown Preview */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-2xl shadow-elevated p-3 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="font-semibold text-xs text-foreground">Clinical Alerts</span>
                <span className="text-[10px] text-muted-foreground font-mono">0 active</span>
              </div>
              <div className="py-6 text-center text-xs space-y-1">
                <p className="font-medium text-foreground">No Active Clinical Alerts</p>
                <p className="text-[11px] text-muted-foreground">All patient vitals and facility alerts are normal.</p>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="w-9 h-9 rounded-xl bg-surface hover:bg-surface-elevated border border-border text-foreground flex items-center justify-center hover:border-primary/50 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-primary" />
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => onSelectModule && onSelectModule('system_admin')}
          title="System Settings"
          aria-label="System Settings"
          className="w-9 h-9 rounded-xl bg-surface hover:bg-surface-elevated border border-border text-muted-foreground hover:text-foreground flex items-center justify-center hover:border-primary/50 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 shadow-xs cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

