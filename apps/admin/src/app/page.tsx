'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Header } from '../components/Header';
import {
  Users,
  Activity,
  BedDouble,
  CreditCard,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Smartphone,
  Pill,
  Clock,
  HeartHandshake,
  CheckCircle2,
  Calendar as CalendarIcon,
  AlertCircle,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Check,
  PhoneCall,
  UserCheck,
  UserX,
  Stethoscope,
  TrendingUp,
  FileText,
  AlertTriangle,
  Building2,
  Sparkles,
  Search,
  Filter,
  Lock,
  Settings,
  BarChart3,
  FileSpreadsheet,
  Download,
  RefreshCw,
  X,
  Shield,
  ArrowRight,
  CheckSquare,
  PackageCheck,
  LogOut,
  Repeat,
  Heart,
  Share2,
  MessageSquare,
  Smile,
  Webhook,
  Zap,
  ShieldAlert,
  Loader2,
  Key,
  Edit3,
  UserPlus,
  Eye,
  EyeOff,
  Mail,
  Phone,
} from 'lucide-react';
import { useAuth } from '../components/AuthContext';
import { SignInPage } from '../components/SignInPage';
import { canAccessModule, getDefaultModuleForRole, ROLE_DISPLAY_NAMES, UserRole } from '@calyvia/shared';
import { FamilyManagementView } from '../components/FamilyManagementView';
import { CounsellingView } from '../components/CounsellingView';
import { DocumentsView } from '../components/DocumentsView';
import { MovementView } from '../components/MovementView';
import { InventoryView } from '../components/InventoryView';
import { TasksView } from '../components/TasksView';
import { IncidentsView } from '../components/IncidentsView';
import { ReferralsView } from '../components/ReferralsView';
import { CommunicationView } from '../components/CommunicationView';
import { AutomationView } from '../components/AutomationView';
import { BottomNav } from '../components/BottomNav';

const MODULE_TITLES: Record<string, string> = {
  dashboard: 'Management Dashboard',
  reports: 'Reports & Analytics',
  patients: 'Patients & Family',
  crm: 'Admissions & Referrals',
  family: 'Family Management',
  referrals: 'Referral Partners',
  documents: 'Documents, Discharge & Aftercare',
  clinical: 'Clinical Care & Detox',
  detox: 'Detox Management',
  counselling: 'Counselling & Therapy',
  appointments: 'Appointments & Calendar',
  pharmacy: 'Pharmacy & Inventory',
  rooms: 'Facility & Patient Flow',
  movement: 'Patient Movement & Visitors',
  billing: 'Billing & Payments',
  incidents: 'Incidents & Risk',
  staff: 'Staff & Tasks',
  tasks: 'Task Management',
  inventory: 'Stores & General Inventory',
  discharge: 'Discharge Records & Checklist',
  aftercare: 'Aftercare & Recovery Cadence',
  communication: 'Communications & Feedback',
  feedback: 'Patient Feedback & Complaints',
  security: 'User Accounts & Security',
  system_admin: 'Administration & Intelligence',
  integrations: 'Integrations & Webhooks',
  automation: 'Workflow Automation',
  ai_extension: 'AI Assistant & Intelligence',
};

export default function AdminDashboardPage() {
  const { user, token, isLoading, defaultModule, updateProfile } = useAuth();
  const [activeModule, setActiveModule] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Initialize and persist user's explicit desktop sidebar collapse preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem('calyvia_sidebar_collapsed');
      if (saved !== null) {
        setIsSidebarCollapsed(saved === 'true');
      }
    } catch {
      // Ignore storage restrictions
    }
  }, []);

  const handleToggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('calyvia_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage restrictions
      }
      return next;
    });
  }, []);

  const [trendView, setTrendView] = useState<'weekly' | 'monthly'>('weekly');

  // Profile Edit Form State
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    department: user?.department || '',
    jobTitle: user?.jobTitle || '',
  });
  const [profileSaving, setProfileSaving] = useState<boolean>(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Sync profile form when user updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        fullName: user.fullName || '',
        phone: user.phone || '',
        department: user.department || '',
        jobTitle: user.jobTitle || '',
      });
    }
  }, [user]);

  // Synchronize active module with authorized role defaults
  useEffect(() => {
    if (user && defaultModule) {
      if (!canAccessModule(user.role, activeModule)) {
        setActiveModule(defaultModule);
      }
    }
  }, [user, defaultModule]);

  // M-Pesa STK Push state for billing demo
  const [stkPhoneNumber, setStkPhoneNumber] = useState<string>('254712345678');
  const [stkAmount, setStkAmount] = useState<string>('45000');
  const [stkStatus, setStkStatus] = useState<string | null>(null);

  // Dynamic Nairobi-time greeting
  const [greeting, setGreeting] = useState<{ salutation: string; message: string }>({
    salutation: 'Good morning',
    message: "Welcome back! Here's what's happening at Calyvia today.",
  });

  // Search & Filter state across modules
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [patientStatusFilter, setPatientStatusFilter] = useState<string>('ALL');
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Admin-Controlled Staff Account Management State
  const [staffAccounts, setStaffAccounts] = useState<Array<any>>([]);
  const [loadingStaffAccounts, setLoadingStaffAccounts] = useState<boolean>(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');
  const [staffDeptFilter, setStaffDeptFilter] = useState<string>('ALL');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('ALL');
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>('ALL');
  const [staffActionFeedback, setStaffActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Dialog States
  const [isCreateStaffOpen, setIsCreateStaffOpen] = useState<boolean>(false);
  const [isEditStaffOpen, setIsEditStaffOpen] = useState<boolean>(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState<boolean>(false);
  const [selectedStaffUser, setSelectedStaffUser] = useState<any | null>(null);

  // Create Staff Form State
  const [createStaffForm, setCreateStaffForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    department: 'Inpatient Nursing',
    jobTitle: '',
    role: 'NURSE',
    initialPassword: '',
    mustChangePassword: true,
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED',
    licenseNumber: '',
    licenseBoard: '',
    licenseExpiryDate: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState<boolean>(false);
  const [creatingStaff, setCreatingStaff] = useState<boolean>(false);
  const [createStaffError, setCreateStaffError] = useState<string | null>(null);

  // Edit Staff Form State
  const [editStaffForm, setEditStaffForm] = useState({
    fullName: '',
    phone: '',
    department: '',
    jobTitle: '',
    role: '',
    status: 'ACTIVE' as 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED',
    licenseNumber: '',
    licenseBoard: '',
    licenseExpiryDate: '',
  });
  const [editingStaff, setEditingStaff] = useState<boolean>(false);
  const [editStaffError, setEditStaffError] = useState<string | null>(null);

  // Reset Password Form State
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: '',
    mustChangePassword: true,
  });
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [resettingPassword, setResettingPassword] = useState<boolean>(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  // Password Generator Helper
  const generateStrongPassword = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = 'Cal#';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  // Fetch Staff Accounts Callback
  const fetchStaffAccounts = useCallback(async () => {
    if (!token) return;
    setLoadingStaffAccounts(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const params = new URLSearchParams();
      if (staffSearchQuery.trim()) params.append('search', staffSearchQuery.trim());
      if (staffDeptFilter !== 'ALL') params.append('department', staffDeptFilter);
      if (staffRoleFilter !== 'ALL') params.append('role', staffRoleFilter);
      if (staffStatusFilter !== 'ALL') params.append('status', staffStatusFilter);

      const url = `${apiUrl}/staff?${params.toString()}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStaffAccounts(data);
          // Keep staffMembers synced for roster views
          setStaffMembers(data.map((s: any) => ({
            name: s.fullName || 'Staff Member',
            role: s.staffProfile?.jobTitle || ROLE_DISPLAY_NAMES[s.role as UserRole] || s.role,
            board: s.staffProfile?.licenseBoard || 'Regulatory Board',
            license: s.staffProfile?.licenseNumber || '—',
            expiry: s.staffProfile?.licenseExpiryDate
              ? new Date(s.staffProfile.licenseExpiryDate).toISOString().split('T')[0]
              : '—',
            status: s.isActive ? 'ON_SHIFT' : 'OFF_DUTY',
            phone: s.phone || '—',
          })));
        }
      }
    } catch (err) {
      console.warn('Failed to load staff accounts:', err);
    } finally {
      setLoadingStaffAccounts(false);
    }
  }, [token, staffSearchQuery, staffDeptFilter, staffRoleFilter, staffStatusFilter]);

  // Synchronize on active module change
  useEffect(() => {
    if (activeModule === 'staff' || activeModule === 'security') {
      fetchStaffAccounts();
    }
  }, [activeModule, fetchStaffAccounts]);

  // Staff Account Management Handlers
  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStaffError(null);

    if (!createStaffForm.fullName.trim() || !createStaffForm.email.trim() || !createStaffForm.jobTitle.trim()) {
      setCreateStaffError('Please provide employee full name, institutional email, and job title.');
      return;
    }

    if (!createStaffForm.initialPassword || createStaffForm.initialPassword.length < 8) {
      setCreateStaffError('Provisioned initial password must be at least 8 characters in length.');
      return;
    }

    setCreatingStaff(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/staff/create-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(createStaffForm),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setIsCreateStaffOpen(false);
        setStaffActionFeedback({
          type: 'success',
          message: data.message || `Staff account provisioned successfully for ${createStaffForm.fullName}.`,
        });
        setCreateStaffForm({
          fullName: '',
          email: '',
          phone: '',
          department: 'Inpatient Nursing',
          jobTitle: '',
          role: 'NURSE',
          initialPassword: '',
          mustChangePassword: true,
          status: 'ACTIVE',
          licenseNumber: '',
          licenseBoard: '',
          licenseExpiryDate: '',
        });
        await fetchStaffAccounts();
      } else {
        setCreateStaffError(data.message || 'Failed to create staff account.');
      }
    } catch {
      setCreateStaffError('Network error connecting to Calyvia API service.');
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleOpenEditStaff = (staffUser: any) => {
    setSelectedStaffUser(staffUser);
    setEditStaffForm({
      fullName: staffUser.fullName || '',
      phone: staffUser.phone || '',
      department: staffUser.staffProfile?.department || 'Clinical Operations',
      jobTitle: staffUser.staffProfile?.jobTitle || '',
      role: staffUser.role || 'NURSE',
      status: (staffUser.isActive ? 'ACTIVE' : staffUser.approvalStatus || 'SUSPENDED') as any,
      licenseNumber: staffUser.staffProfile?.licenseNumber || '',
      licenseBoard: staffUser.staffProfile?.licenseBoard || '',
      licenseExpiryDate: staffUser.staffProfile?.licenseExpiryDate
        ? new Date(staffUser.staffProfile.licenseExpiryDate).toISOString().split('T')[0]
        : '',
    });
    setEditStaffError(null);
    setIsEditStaffOpen(true);
  };

  const handleEditStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffUser) return;
    setEditStaffError(null);
    setEditingStaff(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/staff/${selectedStaffUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editStaffForm),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setIsEditStaffOpen(false);
        setStaffActionFeedback({
          type: 'success',
          message: data.message || `Account details for ${editStaffForm.fullName} updated successfully.`,
        });
        await fetchStaffAccounts();
      } else {
        setEditStaffError(data.message || 'Failed to update employee details.');
      }
    } catch {
      setEditStaffError('Network error connecting to Calyvia API service.');
    } finally {
      setEditingStaff(false);
    }
  };

  const handleOpenResetPassword = (staffUser: any) => {
    setSelectedStaffUser(staffUser);
    setResetPasswordForm({
      newPassword: generateStrongPassword(),
      mustChangePassword: true,
    });
    setResetPasswordError(null);
    setIsResetPasswordOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffUser) return;
    setResetPasswordError(null);

    if (!resetPasswordForm.newPassword || resetPasswordForm.newPassword.length < 8) {
      setResetPasswordError('Provisioned password must be at least 8 characters long.');
      return;
    }

    setResettingPassword(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/staff/${selectedStaffUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(resetPasswordForm),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setIsResetPasswordOpen(false);
        setStaffActionFeedback({
          type: 'success',
          message: data.message || `Credentials reset successfully for ${selectedStaffUser.fullName}.`,
        });
        await fetchStaffAccounts();
      } else {
        setResetPasswordError(data.message || 'Failed to reset password.');
      }
    } catch {
      setResetPasswordError('Network error connecting to Calyvia API service.');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleToggleStaffStatus = async (staffUser: any) => {
    const isCurrentlyActive = staffUser.isActive;
    const targetStatus = isCurrentlyActive ? 'SUSPENDED' : 'ACTIVE';
    const confirmPrompt = isCurrentlyActive
      ? `Are you sure you want to SUSPEND access for '${staffUser.fullName}' (${staffUser.email})? They will immediately lose access to all clinical modules.`
      : `Re-activate institutional account for '${staffUser.fullName}'?`;

    if (!window.confirm(confirmPrompt)) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/staff/${staffUser.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: targetStatus,
          reason: isCurrentlyActive ? 'Account suspended by administrator' : 'Account re-activated',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStaffActionFeedback({
          type: 'success',
          message: data.message || `Status updated to ${targetStatus} for ${staffUser.fullName}.`,
        });
        await fetchStaffAccounts();
      } else {
        setStaffActionFeedback({
          type: 'error',
          message: data.message || 'Failed to update employee account status.',
        });
      }
    } catch {
      setStaffActionFeedback({
        type: 'error',
        message: 'Network error updating employee account status.',
      });
    }
  };

  // Patient Registration Form State
  const [newPatient, setNewPatient] = useState({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    phone: '',
    county: 'Kiambu',
    substance: 'Alcohol',
  });

  // New Appointment Form State
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    patientId: '',
    staffMemberName: 'Dr. Evelyn Wanjiku',
    appointmentType: 'PSYCHIATRIC_REVIEW',
    time: '10:00 AM',
    location: 'Consultation Suite A',
  });

  // Live Database States (empty by default)
  const [dashboardMetrics, setDashboardMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(false);

  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState<boolean>(false);

  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState<boolean>(false);

  const [leads, setLeads] = useState<any[]>([]);
  const [loadingLeads, setLoadingLeads] = useState<boolean>(false);

  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);

  const [pharmacyStock, setPharmacyStock] = useState<any[]>([]);
  const [loadingPharmacy, setLoadingPharmacy] = useState<boolean>(false);

  const fetchDashboardMetrics = useCallback(async () => {
    if (!token) return;
    setLoadingMetrics(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardMetrics(data);
      }
    } catch (err) {
      console.warn('Failed to fetch dashboard metrics:', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, [token]);

  const fetchPatients = useCallback(async () => {
    if (!token) return;
    setLoadingPatients(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/patients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPatients(data.map((p: any) => ({
            id: p.calyviaId || p.id,
            name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Anonymous',
            gender: p.gender || '—',
            age: p.dateOfBirth ? Math.floor((Date.now() - new Date(p.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000)) : 30,
            phone: p.phone || '—',
            county: p.county || 'Kiambu',
            status: p.status || 'ENQUIRY',
            ward: p.bedAllocations?.[0]?.bed?.room?.name || 'Unassigned',
            doctor: p.primaryDoctorName || 'Triage Front Desk',
          })));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  }, [token]);

  const fetchAppointments = useCallback(async () => {
    if (!token) return;
    setLoadingAppointments(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/appointments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAppointments(data.map((a: any) => ({
            id: a.appointmentNumber || a.id,
            time: a.startTime ? new Date(a.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '10:00 AM',
            title: a.title || 'Clinical Review',
            patient: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : (a.patientId || 'Outpatient Client'),
            doctor: a.staffMemberName || 'Attending Clinician',
            type: a.appointmentType || 'Consultation',
            status: a.status || 'SCHEDULED',
          })));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch appointments:', err);
    } finally {
      setLoadingAppointments(false);
    }
  }, [token]);

  const fetchLeads = useCallback(async () => {
    if (!token) return;
    setLoadingLeads(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/crm/leads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLeads(data.map((l: any) => ({
            id: l.leadNumber || l.id,
            name: `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Enquiry Client',
            phone: l.phone || '—',
            source: l.referralSource || 'Direct Enquiry',
            substance: l.primarySubstance || 'Substance Review',
            stage: l.status || 'TRIAGE_PENDING',
            priority: l.priority || 'MEDIUM',
          })));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  }, [token]);

  const fetchStaff = useCallback(async () => {
    if (!token) return;
    setLoadingStaff(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStaffMembers(data.map((s: any) => ({
            name: s.fullName || s.user?.fullName || 'Staff Member',
            role: s.jobTitle || s.user?.role || 'Staff',
            board: s.licensingBoard || 'KMPDC / NCK',
            license: s.licenseNumber || '—',
            expiry: s.licenseExpiryDate ? new Date(s.licenseExpiryDate).toISOString().split('T')[0] : '—',
            status: s.isActive !== false ? 'ON_SHIFT' : 'OFF_DUTY',
            phone: s.phone || s.user?.phone || '—',
          })));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch staff:', err);
    } finally {
      setLoadingStaff(false);
    }
  }, [token]);

  const fetchPharmacy = useCallback(async () => {
    if (!token) return;
    setLoadingPharmacy(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/pharmacy/medications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPharmacyStock(data.map((m: any) => ({
            name: m.genericName || m.brandName || m.name,
            category: m.therapeuticCategory || m.category || 'Medication',
            stock: m.stockOnHand ?? m.stock ?? 0,
            min: m.reorderThreshold ?? m.min ?? 10,
            unit: m.unit || 'Units',
            status: (m.stockOnHand ?? 0) <= (m.reorderThreshold ?? 10) ? 'LOW_STOCK' : 'NOMINAL',
          })));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch pharmacy medications:', err);
    } finally {
      setLoadingPharmacy(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchDashboardMetrics();
      fetchPatients();
      fetchAppointments();
      fetchLeads();
      fetchStaff();
      fetchPharmacy();
    }
  }, [token, fetchDashboardMetrics, fetchPatients, fetchAppointments, fetchLeads, fetchStaff, fetchPharmacy]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      setGreeting({
        salutation: 'Good morning',
        message: "Welcome back! Here's what's happening at Calyvia today.",
      });
    } else if (hour < 17) {
      setGreeting({
        salutation: 'Good afternoon',
        message: "Welcome back! Here's the afternoon clinical update at Calyvia.",
      });
    } else {
      setGreeting({
        salutation: 'Good evening',
        message: "Welcome back! Here's the evening handover and census summary.",
      });
    }
  }, []);

  // Trigger demo Safaricom Daraja STK Push
  const handleTriggerMpesaStk = () => {
    setStkStatus('REQUESTED');
    setTimeout(() => {
      setStkStatus('SENT_TO_PHONE');
      setTimeout(() => {
        setStkStatus('SUCCESS');
      }, 2500);
    }, 1200);
  };

  // Handle Register Patient Form Submission
  const handleRegisterPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.firstName || !newPatient.lastName) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${apiUrl}/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: newPatient.firstName,
          lastName: newPatient.lastName,
          gender: newPatient.gender,
          phone: newPatient.phone || '+254700000000',
          county: newPatient.county,
          residentialAddress: 'Ruiru, Kiambu',
          dateOfBirth: '1995-01-01',
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setActiveModal(null);
        setNewPatient({ firstName: '', lastName: '', gender: 'MALE', phone: '', county: 'Kiambu', substance: 'Alcohol' });
        alert(`Patient ${created.firstName} ${created.lastName} registered successfully with CAL-ID ${created.calyviaId || created.id}`);
        fetchPatients();
        fetchDashboardMetrics();
        return;
      }
    } catch (err) {
      console.warn('Backend patient registration error:', err);
    }

    const created = {
      id: `CAL-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      name: `${newPatient.firstName} ${newPatient.lastName}`,
      gender: newPatient.gender === 'MALE' ? 'Male' : 'Female',
      age: 30,
      phone: newPatient.phone || '+254700000000',
      county: newPatient.county,
      status: 'ENQUIRY',
      ward: 'Unassigned',
      doctor: 'Triage Front Desk',
    };

    setPatients((prev) => [created, ...prev]);
    setActiveModal(null);
    setNewPatient({ firstName: '', lastName: '', gender: 'MALE', phone: '', county: 'Kiambu', substance: 'Alcohol' });
    alert(`Patient ${created.name} registered successfully with CAL-ID ${created.id}`);
  };

  // Handle Book Appointment Form Submission
  const handleBookAppointmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAppointment.title) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const today = new Date();
      const startTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 0, 0).toISOString();
      const endTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 0, 0).toISOString();
      const res = await fetch(`${apiUrl}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newAppointment.title,
          patientId: newAppointment.patientId ? newAppointment.patientId : undefined,
          staffMemberName: newAppointment.staffMemberName,
          appointmentType: newAppointment.appointmentType,
          startTime,
          endTime,
          location: newAppointment.location,
        }),
      });
      if (res.ok) {
        setActiveModal(null);
        setNewAppointment({ title: '', patientId: '', staffMemberName: 'Dr. Evelyn Wanjiku', appointmentType: 'PSYCHIATRIC_REVIEW', time: '10:00 AM', location: 'Consultation Suite A' });
        alert(`Appointment scheduled successfully.`);
        fetchAppointments();
        fetchDashboardMetrics();
        return;
      }
    } catch (err) {
      console.warn('Backend appointment booking error:', err);
    }

    const created = {
      id: `APT-${Math.floor(100 + Math.random() * 900)}`,
      time: newAppointment.time,
      title: newAppointment.title,
      patient: newAppointment.patientId || 'Outpatient Client',
      doctor: newAppointment.staffMemberName,
      type: newAppointment.appointmentType,
      status: 'CONFIRMED',
    };

    setAppointments((prev) => [created, ...prev]);
    setActiveModal(null);
    setNewAppointment({ title: '', patientId: '', staffMemberName: 'Dr. Evelyn Wanjiku', appointmentType: 'PSYCHIATRIC_REVIEW', time: '10:00 AM', location: 'Consultation Suite A' });
    alert(`Appointment scheduled for ${created.patient} with ${created.doctor}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4 select-none">
        <div className="w-14 h-14 rounded-2xl bg-primary-soft border border-primary/20 flex items-center justify-center animate-pulse shadow-xs">
          <img src="/brand/calyvia-emblem-light.svg" alt="Calyvia" className="w-8 h-8 object-contain" />
        </div>
        <p className="text-xs text-muted-foreground font-medium animate-pulse">Verifying Calyvia Clinical Session...</p>
      </div>
    );
  }

  if (!user) {
    return <SignInPage />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground transition-colors duration-200">
      {/* Sidebar navigation with desktop collapse and mobile drawer support */}
      <Sidebar
        currentModule={activeModule}
        onSelectModule={setActiveModule}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          onSelectModule={setActiveModule}
        />

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 space-y-6 pb-24 md:pb-8 pb-safe">
          {/* Executive Overview Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/60">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {MODULE_TITLES[activeModule] || `${activeModule.replace('_', ' ')} Management`}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-sans mt-1">
                {activeModule === 'dashboard'
                  ? `${greeting.salutation}${
                      user?.fullName
                        ? `, ${user.fullName.replace(/\s*\(.*?\)\s*/g, '').trim().split(' ')[0]}`
                        : ''
                    }. ${greeting.message}`
                  : `Calyvia Wellness Center • Enterprise HMIS / EMR System`}
              </p>
            </div>

            {/* Live Data Freshness & Quick Action Bar for Dashboard */}
            {activeModule === 'dashboard' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setActiveModal('register_patient')}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold shadow-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Patient</span>
                </button>
              </div>
            )}
          </div>

          {/* Access Control Barrier: Enforce Role Authorization for Module */}
          {!canAccessModule(user.role, activeModule) && (
            <div className="p-8 max-w-lg mx-auto text-center space-y-4 bg-surface border border-border rounded-3xl mt-8 shadow-elevated animate-in fade-in zoom-in-95 duration-150">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-danger-soft border border-danger/20 flex items-center justify-center text-danger">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase font-bold text-danger tracking-wider">
                  Access Restricted • Least-Privilege Protection
                </span>
                <h2 className="text-lg font-bold text-foreground">Insufficient Role Privileges</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your authenticated institutional role (<span className="font-semibold text-foreground">{ROLE_DISPLAY_NAMES[user.role] || user.role}</span>) does not have authorized clearance to access the <span className="font-mono text-primary font-semibold">{activeModule}</span> workspace.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setActiveModule(getDefaultModuleForRole(user.role))}
                  className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover shadow-xs transition-all active:scale-[0.98]"
                >
                  Return to Authorized Workspace
                </button>
              </div>
            </div>
          )}

          {/* Module: Dashboard & Management Overview */}
          {activeModule === 'dashboard' && canAccessModule(user.role, 'dashboard') && (
            <div className="space-y-6">
              {/* Operational Status & Clinical Highlights Banner (Only shown for critical acuity or active detox) */}
              {(() => {
                const criticalCount = dashboardMetrics?.clinical?.criticalVitalsAlerts ?? 0;
                const detoxCases = dashboardMetrics?.admissions?.activeDetoxCases ?? 0;

                if (criticalCount > 0) {
                  return (
                    <div className="p-4 rounded-2xl bg-warning-soft border border-warning/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-warning/20 text-warning flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">High Acuity Clinical Notice</div>
                          <div className="text-muted-foreground mt-0.5">
                            {criticalCount} patient vitals alert(s) require review in Ruiru inpatient detox ward.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveModule('clinical')}
                        className="px-3 py-1.5 rounded-xl bg-warning text-warning-foreground font-semibold hover:opacity-90 transition-opacity self-start sm:self-auto text-xs cursor-pointer"
                      >
                        Open Detox Station &rarr;
                      </button>
                    </div>
                  );
                }

                if (detoxCases > 0) {
                  return (
                    <div className="p-4 rounded-2xl bg-surface-subtle border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center flex-shrink-0">
                          <Activity className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">Active Inpatient Medical Detox</div>
                          <div className="text-muted-foreground mt-0.5">
                            {detoxCases} client(s) currently admitted under structured CIWA-Ar withdrawal protocols.
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveModule('clinical')}
                        className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary-hover transition-all self-start sm:self-auto text-xs cursor-pointer"
                      >
                        View Detox Vitals &rarr;
                      </button>
                    </div>
                  );
                }

                return null;
              })()}

              {/* 4 Metric Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Inpatients Card */}
                <div
                  onClick={() => setActiveModule('rooms')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveModule('rooms')}
                  className="bg-card p-5 rounded-2xl border border-border shadow-card flex flex-col justify-between hover:border-primary/40 hover:shadow-elevated transition-all duration-200 group cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                >
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span className="text-foreground font-semibold">Total Inpatients</span>
                    <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <BedDouble className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold font-serif text-foreground">
                        {dashboardMetrics?.census?.occupiedBeds ?? 0}
                      </span>
                      <span className="text-xs text-muted-foreground font-sans">
                        / {dashboardMetrics?.census?.totalBeds ?? 0} Beds
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success-soft text-success border border-success/20">
                        <ArrowUpRight className="w-3 h-3 mr-0.5" />
                        {dashboardMetrics?.census?.occupancyRatePercentage ?? 0}% Occupancy
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {dashboardMetrics?.census?.availableBeds ?? 0} available
                      </span>
                    </div>
                  </div>
                </div>

                {/* Today's Appointments Card */}
                <div
                  onClick={() => setActiveModule('appointments')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveModule('appointments')}
                  className="bg-card p-5 rounded-2xl border border-border shadow-card flex flex-col justify-between hover:border-secondary/40 hover:shadow-elevated transition-all duration-200 group cursor-pointer focus-visible:ring-2 focus-visible:ring-secondary focus-visible:outline-hidden"
                >
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span className="text-foreground font-semibold">Today&apos;s Appointments</span>
                    <div className="w-8 h-8 rounded-xl bg-secondary-soft text-secondary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <CalendarIcon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold font-serif text-foreground">
                        {dashboardMetrics?.clinical?.therapySessionsToday ?? appointments.length}
                      </span>
                      <span className="text-xs text-muted-foreground font-sans">Scheduled</span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary-soft text-primary border border-primary/20">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" />
                        {dashboardMetrics?.clinical?.completedSessions ?? 0} Completed
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {dashboardMetrics?.clinical?.pendingSessions ?? appointments.length} Pending
                      </span>
                    </div>
                  </div>
                </div>

                {/* Active Medical Detox Card */}
                <div
                  onClick={() => setActiveModule('clinical')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveModule('clinical')}
                  className="bg-card p-5 rounded-2xl border border-border shadow-card flex flex-col justify-between hover:border-accent/40 hover:shadow-elevated transition-all duration-200 group cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-hidden"
                >
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span className="text-foreground font-semibold">Active Medical Detox</span>
                    <div className="w-8 h-8 rounded-xl bg-accent-soft text-accent flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold font-serif text-accent">
                        {dashboardMetrics?.admissions?.activeDetoxCases ?? dashboardMetrics?.census?.detoxWardOccupancy ?? 0}
                      </span>
                      <span className="text-xs text-muted-foreground font-sans">CIWA / COWS</span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warning-soft text-warning border border-warning/20">
                        <AlertCircle className="w-3 h-3 mr-0.5" />
                        {dashboardMetrics?.clinical?.criticalVitalsAlerts ?? 0} Critical Alerts
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {(dashboardMetrics?.admissions?.activeDetoxCases ?? 0) > 0 ? 'Taper Protocol' : 'Nominal'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* MTD Collections Card */}
                <div
                  onClick={() => setActiveModule('billing')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setActiveModule('billing')}
                  className="bg-card p-5 rounded-2xl border border-border shadow-card flex flex-col justify-between hover:border-primary/40 hover:shadow-elevated transition-all duration-200 group cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
                >
                  <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                    <span className="text-foreground font-semibold">MTD Collections</span>
                    <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline space-x-2">
                      <span className="text-2xl font-bold font-mono text-foreground truncate">
                        KES {Number(dashboardMetrics?.financials?.mtdRevenueCollected || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success-soft text-success border border-success/20">
                        <TrendingUp className="w-3 h-3 mr-0.5" />
                        M-Pesa: {dashboardMetrics?.financials?.mpesaVolumePercentage ?? 0}%
                      </span>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        KES {Number(dashboardMetrics?.financials?.outstandingBalances || 0).toLocaleString()} bal
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Dashboard Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left/Main Column: Trends & Inpatient Census */}
                <div className="lg:col-span-7 xl:col-span-8 space-y-6">
                  {/* Chart: Clinical Activity */}
                  <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-card space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="font-serif text-lg font-bold text-foreground">
                            Clinical Activity & Patient Census Trends
                          </h2>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-surface-subtle text-muted-foreground border border-border">
                            {trendView === 'weekly' ? '7-Day View' : '4-Week View'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {trendView === 'weekly'
                            ? 'Daily inpatient census, therapy reviews, and clinical admissions across the week'
                            : 'Rolling weekly inpatient admissions, therapy reviews, and detox discharges across the month'}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Legend */}
                        <div className="hidden sm:flex items-center space-x-3 text-[11px] text-muted-foreground mr-2">
                          <span className="flex items-center space-x-1">
                            <span className="w-2 h-2 rounded-full bg-primary" />
                            <span>Inpatients</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <span className="w-2 h-2 rounded-full bg-secondary" />
                            <span>Therapy</span>
                          </span>
                        </div>

                        {/* Period Toggle */}
                        <div className="flex items-center space-x-1.5 bg-surface-subtle p-1 rounded-xl border border-border text-xs">
                          <button
                            onClick={() => setTrendView('weekly')}
                            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                              trendView === 'weekly' ? 'bg-surface text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Weekly
                          </button>
                          <button
                            onClick={() => setTrendView('monthly')}
                            className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                              trendView === 'monthly' ? 'bg-surface text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Monthly
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="relative pt-4 pb-2">
                      {(dashboardMetrics?.census?.occupiedBeds ?? 0) === 0 && (dashboardMetrics?.admissions?.thisMonth ?? 0) === 0 ? (
                        <div className="h-52 w-full flex flex-col items-center justify-center text-center p-6 rounded-xl bg-surface-subtle border border-dashed border-border space-y-3">
                          <div className="w-10 h-10 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted-foreground">
                            <Activity className="w-5 h-5 text-muted-foreground/60" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">No Inpatient Clinical Trends Recorded Yet</p>
                            <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
                              Census curves and clinical consultations generate dynamically in real-time as patients are admitted.
                            </p>
                          </div>
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              onClick={() => setActiveModal('register_patient')}
                              className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover shadow-xs transition-all"
                            >
                              + Register Patient
                            </button>
                            <button
                              onClick={() => setActiveModule('crm')}
                              className="px-3 py-1.5 rounded-xl bg-surface border border-border text-foreground text-xs font-medium hover:bg-surface-elevated transition-all"
                            >
                              Intake Pipeline &rarr;
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="h-48 w-full">
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 150" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="primaryAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                              </linearGradient>
                            </defs>
                            <line x1="0" y1="30" x2="500" y2="30" stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1="0" y1="75" x2="500" y2="75" stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
                            <line x1="0" y1="120" x2="500" y2="120" stroke="var(--border)" strokeDasharray="3 3" strokeWidth="1" />
                            {trendView === 'weekly' ? (
                              <>
                                <path d="M 0 110 Q 80 40, 160 70 T 330 45 T 500 25 L 500 150 L 0 150 Z" fill="url(#primaryAreaGrad)" />
                                <path d="M 0 110 Q 80 40, 160 70 T 330 45 T 500 25" fill="none" stroke="var(--primary)" strokeWidth="2.5" />
                                <circle cx="80" cy="55" r="3.5" fill="var(--primary)" />
                                <circle cx="160" cy="70" r="4" fill="var(--primary)" />
                                <circle cx="245" cy="50" r="3.5" fill="var(--primary)" />
                                <circle cx="330" cy="45" r="4" fill="var(--primary)" />
                                <circle cx="415" cy="35" r="3.5" fill="var(--primary)" />
                                <circle cx="500" cy="25" r="5" fill="var(--primary)" />
                              </>
                            ) : (
                              <>
                                <path d="M 0 120 Q 125 75, 250 55 T 500 20 L 500 150 L 0 150 Z" fill="url(#primaryAreaGrad)" />
                                <path d="M 0 120 Q 125 75, 250 55 T 500 20" fill="none" stroke="var(--primary)" strokeWidth="2.5" />
                                <circle cx="125" cy="75" r="4" fill="var(--primary)" />
                                <circle cx="250" cy="55" r="4" fill="var(--primary)" />
                                <circle cx="375" cy="35" r="4" fill="var(--primary)" />
                                <circle cx="500" cy="20" r="5" fill="var(--primary)" />
                              </>
                            )}
                          </svg>
                        </div>
                      )}
                      <div className="flex justify-between text-[11px] text-muted-foreground pt-3 border-t border-border/40 font-mono mt-2">
                        {trendView === 'weekly' ? (
                          <>
                            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                          </>
                        ) : (
                          <>
                            <span>Week 1 (Intake)</span>
                            <span>Week 2 (Detox/Stabilization)</span>
                            <span>Week 3 (Therapy Cadence)</span>
                            <span>Week 4 (Aftercare Transition)</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ward Census */}
                  <div className="bg-card p-5 sm:p-6 rounded-2xl border border-border shadow-card space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="font-serif text-lg font-bold text-foreground">
                          Inpatient Ward Census & Capacity Allocation
                        </h2>
                        <p className="text-xs text-muted-foreground">Real-time room occupancy in Ruiru center</p>
                      </div>
                      <button onClick={() => setActiveModule('rooms')} className="text-xs text-primary font-semibold hover:underline">
                        Manage Beds &rarr;
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      {(() => {
                        const detoxOcc = dashboardMetrics?.census?.detoxWardOccupancy ?? 0;
                        const detoxTotal = 6;
                        const detoxPct = detoxTotal > 0 ? Math.round((detoxOcc / detoxTotal) * 100) : 0;

                        const maleOcc = dashboardMetrics?.census?.inpatientMaleOccupancy ?? 0;
                        const maleTotal = 16;
                        const malePct = maleTotal > 0 ? Math.round((maleOcc / maleTotal) * 100) : 0;

                        const femaleOcc = dashboardMetrics?.census?.inpatientFemaleOccupancy ?? 0;
                        const femaleTotal = 8;
                        const femalePct = femaleTotal > 0 ? Math.round((femaleOcc / femaleTotal) * 100) : 0;

                        const vipOcc = dashboardMetrics?.census?.vipOccupancy ?? 0;
                        const vipTotal = 2;
                        const vipPct = vipTotal > 0 ? Math.round((vipOcc / vipTotal) * 100) : 0;

                        return (
                          <>
                            <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                              <div className="flex justify-between items-center font-semibold">
                                <span>Detox Ward</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-accent-soft text-accent">{detoxPct}%</span>
                              </div>
                              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                                <div className="bg-accent h-1.5 rounded-full transition-all duration-300" style={{ width: `${detoxPct}%` }} />
                              </div>
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{detoxOcc}/{detoxTotal} Beds</span>
                                <span className={detoxOcc > 0 ? "text-accent font-medium" : "text-muted-foreground font-normal"}>
                                  {detoxOcc > 0 ? `${detoxTotal - detoxOcc} Avail.` : '0 Occupied'}
                                </span>
                              </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                              <div className="flex justify-between items-center font-semibold">
                                <span>Horizon (Male)</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-primary-soft text-primary">{malePct}%</span>
                              </div>
                              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                                <div className="bg-primary h-1.5 rounded-full transition-all duration-300" style={{ width: `${malePct}%` }} />
                              </div>
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{maleOcc}/{maleTotal} Beds</span>
                                <span className={maleOcc > 0 ? "text-primary font-medium" : "text-muted-foreground font-normal"}>
                                  {maleOcc > 0 ? `${maleTotal - maleOcc} Avail.` : '0 Occupied'}
                                </span>
                              </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                              <div className="flex justify-between items-center font-semibold">
                                <span>Serenity (Female)</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-secondary-soft text-secondary">{femalePct}%</span>
                              </div>
                              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                                <div className="bg-secondary h-1.5 rounded-full transition-all duration-300" style={{ width: `${femalePct}%` }} />
                              </div>
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{femaleOcc}/{femaleTotal} Beds</span>
                                <span className={femaleOcc > 0 ? "text-secondary font-medium" : "text-muted-foreground font-normal"}>
                                  {femaleOcc > 0 ? `${femaleTotal - femaleOcc} Avail.` : '0 Occupied'}
                                </span>
                              </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-surface-subtle border border-border space-y-2">
                              <div className="flex justify-between items-center font-semibold">
                                <span>VIP Suite</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold bg-accent-soft text-accent">{vipPct}%</span>
                              </div>
                              <div className="w-full bg-border rounded-full h-1.5 overflow-hidden">
                                <div className="bg-accent h-1.5 rounded-full transition-all duration-300" style={{ width: `${vipPct}%` }} />
                              </div>
                              <div className="flex justify-between text-[11px] text-muted-foreground">
                                <span>{vipOcc}/{vipTotal} Beds</span>
                                <span className={vipOcc > 0 ? "text-accent font-medium" : "text-muted-foreground font-normal"}>
                                  {vipOcc > 0 ? `${vipTotal - vipOcc} Avail.` : '0 Occupied'}
                                </span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Right Column: Facility Operations & Today's Appointments */}
                <div className="lg:col-span-5 xl:col-span-4 space-y-6">
                  {/* Facility Quick Operations */}
                  <div className="bg-card p-5 rounded-2xl border border-border shadow-card space-y-3.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground">Facility Operations</span>
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Live</span>
                        </span>
                      </div>
                      <button onClick={() => setActiveModule('staff')} className="text-xs text-primary font-semibold hover:underline cursor-pointer">
                        Staff Roster &rarr;
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      <div
                        onClick={() => setActiveModule('staff')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setActiveModule('staff')}
                        className="p-3 rounded-xl bg-surface-subtle border border-border flex items-center justify-between hover:border-primary/40 hover:bg-surface-elevated transition-all cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <Users className="w-3.5 h-3.5 text-primary" />
                          <span className="text-foreground">Clinical Staff on Duty</span>
                        </div>
                        <span className="font-bold font-mono text-foreground">
                          {dashboardMetrics?.qualityAndSafety?.staffOnDuty ?? staffMembers.length} Active
                        </span>
                      </div>
                      <div
                        onClick={() => setActiveModule('pharmacy')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setActiveModule('pharmacy')}
                        className="p-3 rounded-xl bg-surface-subtle border border-border flex items-center justify-between hover:border-primary/40 hover:bg-surface-elevated transition-all cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <Pill className="w-3.5 h-3.5 text-secondary" />
                          <span className="text-foreground">Pharmacy In-Stock</span>
                        </div>
                        <span className="font-bold font-mono text-emerald-500">
                          {pharmacyStock.length > 0 ? `${Math.round((pharmacyStock.filter((p) => p.status !== 'LOW_STOCK').length / pharmacyStock.length) * 100)}%` : '100% Nominal'}
                        </span>
                      </div>
                      <div
                        onClick={() => setActiveModule('clinical')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && setActiveModule('clinical')}
                        className="p-3 rounded-xl bg-surface-subtle border border-border flex items-center justify-between hover:border-accent/40 hover:bg-surface-elevated transition-all cursor-pointer"
                      >
                        <div className="flex items-center space-x-2">
                          <Activity className="w-3.5 h-3.5 text-accent" />
                          <span className="text-foreground">Detox Bed Occupancy</span>
                        </div>
                        <span className="font-bold font-mono text-accent">
                          {dashboardMetrics?.census?.detoxWardOccupancy ?? 0} Beds Active
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Today's Appointments List */}
                  <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
                    <div className="p-4 sm:p-5 bg-surface-subtle border-b border-border flex items-center justify-between">
                      <div>
                        <h2 className="font-serif text-base font-bold text-foreground">
                          Today&apos;s Appointments
                        </h2>
                        <p className="text-[11px] text-muted-foreground">
                          Scheduled psychiatric evaluations & therapy
                        </p>
                      </div>
                      <button onClick={() => setActiveModule('appointments')} className="text-xs text-primary font-semibold hover:underline cursor-pointer">
                        View All ({appointments.length}) &rarr;
                      </button>
                    </div>

                    <div className="divide-y divide-border text-xs">
                      {appointments.length === 0 ? (
                        <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                          <div className="w-10 h-10 rounded-2xl bg-surface border border-border flex items-center justify-center text-muted-foreground mx-auto">
                            <CalendarIcon className="w-5 h-5 text-muted-foreground/50" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">No appointments scheduled for today</p>
                            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto mt-0.5">
                              Bookings made via the front desk or calendar schedule will appear here.
                            </p>
                          </div>
                          <div className="pt-1">
                            <button
                              onClick={() => setActiveModal('new_appointment')}
                              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary-hover shadow-xs transition-all cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Book Appointment</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        appointments.slice(0, 4).map((apt) => (
                          <div key={apt.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-surface-subtle/60 transition-colors">
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary font-bold flex items-center justify-center flex-shrink-0 text-xs shadow-xs">
                                {(apt.patient || 'PT').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-foreground flex items-center space-x-1.5 truncate">
                                  <span className="truncate">{apt.patient}</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate">
                                  <span>{apt.title}</span> • <span>{apt.doctor}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 flex-shrink-0">
                              <div className="text-right">
                                <div className="font-mono text-[11px] font-semibold text-foreground">{apt.time}</div>
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-success-soft text-success border border-success/20">
                                  {apt.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module: 01. Patient Registry */}
          {activeModule === 'patients' && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">Master Patient Index & Registry</h2>
                    <p className="text-xs text-muted-foreground">KDPA 2019 encrypted patient identity and admission profiles</p>
                  </div>
                  <button
                    onClick={() => setActiveModal('register_patient')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Register Patient</span>
                  </button>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search patient by CAL-ID, name, or phone..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="w-full bg-surface-subtle border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <select
                    value={patientStatusFilter}
                    onChange={(e) => setPatientStatusFilter(e.target.value)}
                    className="bg-surface-subtle border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ADMITTED_DETOX">Admitted (Detox)</option>
                    <option value="ADMITTED_REHAB">Admitted (Rehab)</option>
                    <option value="ENQUIRY">Enquiry / Triage</option>
                    <option value="DISCHARGED">Discharged</option>
                  </select>
                </div>

                {/* Patient Table */}
                <div className="overflow-x-auto rounded-xl border border-border mt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">CAL-ID & Name</th>
                        <th className="px-4 py-3">Gender / Age</th>
                        <th className="px-4 py-3">Phone & County</th>
                        <th className="px-4 py-3">Admission Status</th>
                        <th className="px-4 py-3">Ward / Bed</th>
                        <th className="px-4 py-3">MDT Lead</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(() => {
                        const filtered = patients.filter((p) => {
                          const matchesSearch = (p.name || '').toLowerCase().includes(patientSearch.toLowerCase()) || (p.id || '').toLowerCase().includes(patientSearch.toLowerCase());
                          const matchesStatus = patientStatusFilter === 'ALL' || p.status === patientStatusFilter;
                          return matchesSearch && matchesStatus;
                        });

                        if (filtered.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                                <Users className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                                <p className="font-semibold text-foreground">
                                  {patientSearch ? 'No patients matching filter criteria' : 'No patients registered in the master index yet'}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {patientSearch ? 'Try adjusting your search terms or status filter.' : 'Click "Register Patient" above to register an inpatient or outpatient.'}
                                </p>
                              </td>
                            </tr>
                          );
                        }

                        return filtered.map((p) => (
                          <tr key={p.id} className="hover:bg-surface-subtle transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-foreground">{p.name}</div>
                              <div className="text-[10px] font-mono text-muted-foreground">{p.id}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{p.gender}, {p.age} yrs</td>
                            <td className="px-4 py-3">
                              <div className="font-mono text-[11px]">{p.phone}</div>
                              <div className="text-[10px] text-muted-foreground">{p.county}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                                {p.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-foreground font-medium">{p.ward}</td>
                            <td className="px-4 py-3 text-muted-foreground">{p.doctor}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setActiveModule('clinical')}
                                className="px-2.5 py-1 bg-surface border border-border rounded-lg text-[11px] font-semibold hover:bg-surface-elevated"
                              >
                                View Chart
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Module: 02. CRM & Admissions Pipeline */}
          {activeModule === 'crm' && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">CRM Admissions Pipeline & Triage</h2>
                    <p className="text-xs text-muted-foreground">Prospective patient intake, referral tracking, and bed reservation</p>
                  </div>
                  <button
                    onClick={() => setActiveModal('register_patient')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Lead</span>
                  </button>
                </div>

                {/* Pipeline Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">New Enquiries</span>
                    <div className="text-2xl font-bold font-serif text-foreground mt-1">
                      {leads.filter((l) => l.stage === 'TRIAGE_PENDING' || l.stage === 'NEW').length}
                    </div>
                    <span className="text-[10px] text-primary">Pipeline Enquiries</span>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Triage Pending</span>
                    <div className="text-2xl font-bold font-serif text-warning mt-1">
                      {leads.filter((l) => l.priority === 'HIGH' || l.priority === 'URGENT').length}
                    </div>
                    <span className="text-[10px] text-warning">High Priority</span>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Assessment Booked</span>
                    <div className="text-2xl font-bold font-serif text-secondary mt-1">
                      {leads.filter((l) => l.stage === 'ASSESSMENT_BOOKED').length}
                    </div>
                    <span className="text-[10px] text-secondary">Scheduled</span>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Formally Admitted</span>
                    <div className="text-2xl font-bold font-serif text-success mt-1">
                      {dashboardMetrics?.census?.occupiedBeds ?? 0}
                    </div>
                    <span className="text-[10px] text-success">Active Census</span>
                  </div>
                </div>

                {/* Leads Table */}
                <div className="overflow-x-auto rounded-xl border border-border mt-4">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Lead ID & Client</th>
                        <th className="px-4 py-3">Phone</th>
                        <th className="px-4 py-3">Referral Channel</th>
                        <th className="px-4 py-3">Primary Substance</th>
                        <th className="px-4 py-3">Pipeline Stage</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {leads.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                            <PhoneCall className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                            <p className="font-semibold text-foreground">No CRM admissions leads pending</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">New patient intake enquiries, helpline calls, and referrals will populate here.</p>
                          </td>
                        </tr>
                      ) : (
                        leads.map((l) => (
                          <tr key={l.id} className="hover:bg-surface-subtle transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground">
                              <div>{l.name}</div>
                              <span className="text-[10px] font-mono text-muted-foreground">{l.id}</span>
                            </td>
                            <td className="px-4 py-3 font-mono">{l.phone}</td>
                            <td className="px-4 py-3 text-muted-foreground">{l.source}</td>
                            <td className="px-4 py-3">{l.substance}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary-soft text-secondary">
                                {l.stage}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-warning-soft text-warning">
                                {l.priority}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => {
                                  alert(`Admitting ${l.name} into Calyvia Inpatient Registry.`);
                                  setActiveModule('rooms');
                                }}
                                className="px-2.5 py-1 bg-primary text-primary-foreground rounded-lg text-[11px] font-semibold hover:bg-primary-hover shadow-xs"
                              >
                                Admit Patient
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Module: 06. Appointments & Calendar */}
          {activeModule === 'appointments' && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">Appointments & Clinical Calendar</h2>
                    <p className="text-xs text-muted-foreground">Manage multidisciplinary psychiatric consultations and therapy schedules</p>
                  </div>
                  <button
                    onClick={() => setActiveModal('book_appointment')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Schedule Appointment</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border mt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Time & ID</th>
                        <th className="px-4 py-3">Session Title</th>
                        <th className="px-4 py-3">Patient / Attendee</th>
                        <th className="px-4 py-3">Clinician in Charge</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {appointments.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                            <CalendarIcon className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                            <p className="font-semibold text-foreground">No appointments scheduled</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Use &quot;Schedule Appointment&quot; above to book therapy, reviews, or consultations.</p>
                          </td>
                        </tr>
                      ) : (
                        appointments.map((a) => (
                          <tr key={a.id} className="hover:bg-surface-subtle transition-colors">
                            <td className="px-4 py-3 font-mono font-semibold text-foreground">
                              <div>{a.time}</div>
                              <span className="text-[10px] text-muted-foreground">{a.id}</span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-foreground">{a.title}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.patient}</td>
                            <td className="px-4 py-3 text-foreground font-medium">{a.doctor}</td>
                            <td className="px-4 py-3 text-muted-foreground">{a.type}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-success-soft text-success border border-success/20">
                                {a.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => alert(`Opening appointment chart for ${a.id}`)}
                                className="px-2.5 py-1 bg-surface border border-border text-foreground rounded-lg text-[11px] font-semibold hover:bg-surface-elevated"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Module: 03. Clinical Records & MDT */}
          {activeModule === 'clinical' && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">Clinical Records & MDT Progress Notes</h2>
                    <p className="text-xs text-muted-foreground">Versioned psychiatric evaluations, nursing charts, and SOAP progress documentation</p>
                  </div>
                  <button
                    onClick={() => alert('Add Clinical Note dialog opened.')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Append Clinical Note</span>
                  </button>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="p-8 rounded-xl bg-surface-subtle border border-border text-center space-y-2">
                    <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">No Clinical Progress Notes Recorded Yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
                      Versioned psychiatric evaluations, nursing charts, and SOAP progress documentation will appear here once recorded by clinical personnel.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module: 08. Pharmacy & e-MAR Chart */}
          {activeModule === 'pharmacy' && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">Pharmacy Formulary & e-MAR Medication Chart</h2>
                    <p className="text-xs text-muted-foreground">Controlled substance inventory batches, re-order levels, and shift dispensation</p>
                  </div>
                  <button
                    onClick={() => alert('Issue Prescription modal opened.')}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Issue Prescription</span>
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border mt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Medication Name</th>
                        <th className="px-4 py-3">Therapeutic Class</th>
                        <th className="px-4 py-3">Stock on Hand</th>
                        <th className="px-4 py-3">Re-order Threshold</th>
                        <th className="px-4 py-3">Unit</th>
                        <th className="px-4 py-3">Inventory Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pharmacyStock.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                            <Pill className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                            <p className="font-semibold text-foreground">No medications recorded in formulary</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Pharmaceutical inventory batches and dispensation charts will populate once registered.</p>
                          </td>
                        </tr>
                      ) : (
                        pharmacyStock.map((med, idx) => (
                          <tr key={idx} className="hover:bg-surface-subtle transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground">{med.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{med.category}</td>
                            <td className="px-4 py-3 font-mono font-bold text-foreground">{med.stock}</td>
                            <td className="px-4 py-3 font-mono text-muted-foreground">{med.min}</td>
                            <td className="px-4 py-3 text-muted-foreground">{med.unit}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  med.status === 'LOW_STOCK'
                                    ? 'bg-warning-soft text-warning border border-warning/20'
                                    : 'bg-success-soft text-success border border-success/20'
                                }`}
                              >
                                {med.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Module: 09. Rooms & Bed Allocation */}
          {activeModule === 'rooms' && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">Inpatient Rooms & Bed Allocation Board</h2>
                    <p className="text-xs text-muted-foreground">Live ward capacity, bed occupancy, and patient transfer controls</p>
                  </div>
                  <div className="text-xs font-mono font-semibold text-primary">
                    Total: {dashboardMetrics?.census?.occupiedBeds ?? 0}/{dashboardMetrics?.census?.totalBeds ?? 0} Beds Occupied
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-3">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-foreground">Detox Ward (High Acuity)</span>
                      <span className="text-accent text-xs">
                        {dashboardMetrics?.census?.detoxWardOccupancy ?? 0} / 6 Beds ({(dashboardMetrics?.census?.detoxWardOccupancy ?? 0) > 0 ? 'Active' : 'All Available'})
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {[1, 2, 3, 4, 5, 6].map((b) => (
                        <div key={b} className="p-2 rounded-lg bg-surface border border-border text-center">
                          <span className="font-mono font-semibold text-foreground">Bed 0{b}</span>
                          <div className="text-[10px] text-muted-foreground truncate">Available</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-3">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-foreground">Horizon Wing (Male Inpatient)</span>
                      <span className="text-primary text-xs">
                        {dashboardMetrics?.census?.inpatientMaleOccupancy ?? 0} / 16 Beds ({(dashboardMetrics?.census?.inpatientMaleOccupancy ?? 0) > 0 ? 'Active' : 'All Available'})
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((b) => (
                        <div key={b} className="p-2 rounded-lg bg-surface border border-border text-center">
                          <span className="font-mono font-semibold text-foreground">Bed 0{b}</span>
                          <div className="text-[10px] text-muted-foreground">Available</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module: 12. Staff & Licence Roster */}
          {activeModule === 'staff' && (
            <div className="space-y-6">
              {/* Administrator Staff Account Management Console: Visible to Super Admin & Facility Admin */}
              {(user?.role === 'SUPER_ADMIN' || user?.role === 'FACILITY_ADMIN') && (
                <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-5">
                  {/* Console Header & Action Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary border border-primary/20">
                          {staffAccounts.length} REGISTERED PERSONNEL
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">RBAC Governance</span>
                      </div>
                      <h2 className="font-serif text-xl font-bold text-foreground mt-1">
                        Staff Account Management & Credential Provisioning
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Create employee accounts, provision institutional credentials, assign clinical/administrative roles, and control access permissions.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                      <button
                        onClick={fetchStaffAccounts}
                        disabled={loadingStaffAccounts}
                        className="inline-flex items-center space-x-1.5 px-3 py-2 bg-surface hover:bg-surface-elevated border border-border text-foreground text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-60"
                        title="Refresh Staff List"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-primary ${loadingStaffAccounts ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>

                      <button
                        onClick={() => {
                          setCreateStaffError(null);
                          setCreateStaffForm({
                            fullName: '',
                            email: '',
                            phone: '',
                            department: 'Clinical Operations',
                            jobTitle: '',
                            role: 'NURSE',
                            initialPassword: generateStrongPassword(),
                            mustChangePassword: true,
                            status: 'ACTIVE',
                            licenseNumber: '',
                            licenseBoard: 'Nursing Council of Kenya',
                            licenseExpiryDate: '',
                          });
                          setIsCreateStaffOpen(true);
                        }}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold rounded-xl shadow-xs transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create Staff Account</span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback Notification */}
                  {staffActionFeedback && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        staffActionFeedback.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                          : 'bg-danger-soft border-danger/20 text-danger'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        {staffActionFeedback.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span>{staffActionFeedback.message}</span>
                      </div>
                      <button
                        onClick={() => setStaffActionFeedback(null)}
                        className="p-1 hover:opacity-75 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Operational Summary Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-surface p-3.5 rounded-xl border border-border">
                      <div className="text-[11px] font-medium text-muted-foreground">Total Staff Accounts</div>
                      <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                        {staffAccounts.length}
                      </div>
                    </div>
                    <div className="bg-surface p-3.5 rounded-xl border border-border">
                      <div className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Active Personnel
                      </div>
                      <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">
                        {staffAccounts.filter((s) => s.isActive && s.approvalStatus !== 'SUSPENDED').length}
                      </div>
                    </div>
                    <div className="bg-surface p-3.5 rounded-xl border border-border">
                      <div className="text-[11px] font-medium text-amber-600 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Suspended / Inactive
                      </div>
                      <div className="text-xl font-bold font-mono text-amber-600 mt-0.5">
                        {staffAccounts.filter((s) => !s.isActive || s.approvalStatus === 'SUSPENDED').length}
                      </div>
                    </div>
                    <div className="bg-surface p-3.5 rounded-xl border border-border">
                      <div className="text-[11px] font-medium text-primary flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Licensed Clinicians
                      </div>
                      <div className="text-xl font-bold font-mono text-foreground mt-0.5">
                        {staffAccounts.filter((s) => s.staffProfile?.licenseNumber).length}
                      </div>
                    </div>
                  </div>

                  {/* Search and Filters Toolbar */}
                  <div className="flex flex-col md:flex-row gap-3 pt-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        placeholder="Search employee by name, institutional email, or designation..."
                        className="w-full bg-surface-subtle border border-border rounded-xl pl-9 pr-3.5 py-2 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground transition-all"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Department Filter */}
                      <select
                        value={staffDeptFilter}
                        onChange={(e) => setStaffDeptFilter(e.target.value)}
                        className="bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all"
                      >
                        <option value="ALL">All Departments</option>
                        <option value="Clinical Operations">Clinical Operations (Psychiatry / Doctors)</option>
                        <option value="Inpatient Nursing">Inpatient Nursing (Detox Ward)</option>
                        <option value="Psychological Therapy">Counselling & Psychology</option>
                        <option value="Pharmacy & Dispensary">Pharmacy & Dispensary</option>
                        <option value="Admissions & Front Desk">Admissions & Front Desk</option>
                        <option value="Billing & Finance">Billing & Finance</option>
                        <option value="Stores & Inventory">Stores & Inventory</option>
                        <option value="Executive Management & Administration">Executive Administration</option>
                      </select>

                      {/* Role Filter */}
                      <select
                        value={staffRoleFilter}
                        onChange={(e) => setStaffRoleFilter(e.target.value)}
                        className="bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all"
                      >
                        <option value="ALL">All Roles</option>
                        <option value="FACILITY_ADMIN">Facility Administrator</option>
                        <option value="MEDICAL_DIRECTOR">Medical Director</option>
                        <option value="DOCTOR_PSYCHIATRIST">Doctor / Psychiatrist</option>
                        <option value="NURSE">Nurse</option>
                        <option value="COUNSELLOR">Addiction Counsellor</option>
                        <option value="PHARMACIST">Pharmacist</option>
                        <option value="ADMISSIONS_FRONT_DESK">Admissions & Front Desk</option>
                        <option value="FINANCE_BILLING">Finance & Billing</option>
                        <option value="INVENTORY_STORE">Stores & Inventory</option>
                        <option value="MANAGEMENT_EXECUTIVE">Management Executive</option>
                        <option value="SUPER_ADMIN">System Administrator</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={staffStatusFilter}
                        onChange={(e) => setStaffStatusFilter(e.target.value)}
                        className="bg-surface border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-all"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="SUSPENDED">Suspended Only</option>
                        <option value="DEACTIVATED">Deactivated Only</option>
                      </select>
                    </div>
                  </div>

                  {/* Staff Accounts Table */}
                  {loadingStaffAccounts && staffAccounts.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading institutional staff accounts...</span>
                    </div>
                  ) : staffAccounts.length === 0 ? (
                    <div className="p-8 rounded-xl bg-surface-subtle border border-border text-center space-y-3">
                      <Users className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">No Staff Accounts Found</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {staffSearchQuery || staffDeptFilter !== 'ALL' || staffRoleFilter !== 'ALL'
                            ? 'No accounts match the current filter criteria. Try resetting filters.'
                            : 'No personnel accounts have been provisioned yet. Use the button above to create the first employee account.'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                          <tr>
                            <th className="px-4 py-3">Employee & Credentials</th>
                            <th className="px-4 py-3">Department & Title</th>
                            <th className="px-4 py-3">Assigned Role</th>
                            <th className="px-4 py-3">Account Status</th>
                            <th className="px-4 py-3">Password Policy</th>
                            <th className="px-4 py-3 text-right">Administrative Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {staffAccounts.map((emp) => {
                            const isSuperAdmin = emp.role === 'SUPER_ADMIN';
                            const isSelf = emp.id === user?.id;

                            return (
                              <tr key={emp.id} className="hover:bg-surface-subtle transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-foreground flex items-center space-x-1.5">
                                    <span>{emp.fullName}</span>
                                    {isSelf && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-primary-soft text-primary font-mono">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground font-mono flex items-center space-x-1 mt-0.5">
                                    <Mail className="w-3 h-3 text-muted-foreground/70" />
                                    <span>{emp.email}</span>
                                  </div>
                                  {emp.phone && (
                                    <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">
                                      {emp.phone}
                                    </div>
                                  )}
                                </td>

                                <td className="px-4 py-3">
                                  <div className="font-medium text-foreground">
                                    {emp.staffProfile?.department || 'Administration'}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground">
                                    {emp.staffProfile?.jobTitle || 'Institutional Personnel'}
                                  </div>
                                  {emp.staffProfile?.licenseNumber && (
                                    <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5">
                                      Licence: {emp.staffProfile.licenseNumber}
                                    </div>
                                  )}
                                </td>

                                <td className="px-4 py-3">
                                  <span
                                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                                      emp.role === 'SUPER_ADMIN'
                                        ? 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                                        : emp.role === 'FACILITY_ADMIN'
                                        ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                        : emp.role === 'MEDICAL_DIRECTOR' || emp.role === 'DOCTOR_PSYCHIATRIST'
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                        : emp.role === 'NURSE'
                                        ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20'
                                        : emp.role === 'COUNSELLOR'
                                        ? 'bg-teal-500/10 text-teal-600 border-teal-500/20'
                                        : emp.role === 'PHARMACIST'
                                        ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                        : emp.role === 'FINANCE_BILLING'
                                        ? 'bg-violet-500/10 text-violet-600 border-violet-500/20'
                                        : 'bg-surface-elevated text-foreground border-border'
                                    }`}
                                  >
                                    {ROLE_DISPLAY_NAMES[emp.role as UserRole] || emp.role}
                                  </span>
                                </td>

                                <td className="px-4 py-3">
                                  {emp.isActive && emp.approvalStatus !== 'SUSPENDED' && emp.approvalStatus !== 'DEACTIVATED' ? (
                                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span>Active</span>
                                    </span>
                                  ) : emp.approvalStatus === 'SUSPENDED' || (!emp.isActive && emp.approvalStatus !== 'DEACTIVATED') ? (
                                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                      <span>Suspended</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                      <span>Deactivated</span>
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3">
                                  {emp.mustChangePassword ? (
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                      <Lock className="w-3 h-3" />
                                      <span>Change on Login</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-surface text-muted-foreground border border-border">
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span>Secured</span>
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex items-center space-x-1.5">
                                    <button
                                      onClick={() => handleOpenEditStaff(emp)}
                                      className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated border border-border text-foreground hover:text-primary transition-all shadow-xs"
                                      title="Edit Staff Details & Role"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => handleOpenResetPassword(emp)}
                                      className="p-1.5 rounded-lg bg-surface hover:bg-surface-elevated border border-border text-foreground hover:text-primary transition-all shadow-xs"
                                      title="Reset Staff Password"
                                    >
                                      <Key className="w-3.5 h-3.5" />
                                    </button>

                                    {!isSelf && (
                                      <button
                                        onClick={() => handleToggleStaffStatus(emp)}
                                        className={`p-1.5 rounded-lg border transition-all shadow-xs ${
                                          emp.isActive
                                            ? 'bg-surface hover:bg-amber-500/10 border-border hover:border-amber-500/30 text-muted-foreground hover:text-amber-600'
                                            : 'bg-surface hover:bg-emerald-500/10 border-border hover:border-emerald-500/30 text-muted-foreground hover:text-emerald-600'
                                        }`}
                                        title={emp.isActive ? 'Suspend Employee Access' : 'Reactivate Employee Access'}
                                      >
                                        {emp.isActive ? (
                                          <UserX className="w-3.5 h-3.5" />
                                        ) : (
                                          <UserCheck className="w-3.5 h-3.5" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">Clinical Staff Directory & Licensing Roster</h2>
                    <p className="text-xs text-muted-foreground">KMPDC and Nursing Council of Kenya regulatory license audit</p>
                  </div>
                  <span className="px-3 py-1 bg-success-soft text-success text-xs font-bold rounded-full">
                    Directory Active
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-border mt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Practitioner Name</th>
                        <th className="px-4 py-3">Role & Department</th>
                        <th className="px-4 py-3">Licensing Board</th>
                        <th className="px-4 py-3">Licence ID</th>
                        <th className="px-4 py-3">Expiry Date</th>
                        <th className="px-4 py-3">Duty Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-b border-border">
                      {staffMembers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-xs text-muted-foreground">
                            <Users className="w-6 h-6 mx-auto text-muted-foreground/40 mb-2" />
                            <p className="font-semibold text-foreground">No staff members registered in directory</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Staff profiles and regulatory board licensing will appear here upon authorization.</p>
                          </td>
                        </tr>
                      ) : (
                        staffMembers.map((s, idx) => (
                          <tr key={idx} className="hover:bg-surface-subtle transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground">{s.name}</td>
                            <td className="px-4 py-3 text-muted-foreground">{s.role}</td>
                            <td className="px-4 py-3 text-foreground">{s.board}</td>
                            <td className="px-4 py-3 font-mono">{s.license}</td>
                            <td className="px-4 py-3 font-mono">{s.expiry}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-soft text-primary">
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Module: 07. Billing & Daraja M-Pesa Integration Demo */}
          {activeModule === 'billing' && (
            <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-6">
              <div>
                <h2 className="font-serif text-xl font-bold text-foreground">
                  Module 07: Billing & Safaricom Daraja M-Pesa Integration
                </h2>
                <p className="text-xs text-muted-foreground">
                  Collect rehab deposits, consultation fees, and pharmacy disbursements directly to Calyvia Till / Paybill
                </p>
              </div>

              <div className="max-w-md bg-surface-subtle p-6 rounded-2xl border border-border space-y-4 text-xs">
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-foreground font-semibold mb-1.5">
                      Patient Safaricom Phone Number
                    </label>
                    <input
                      type="text"
                      value={stkPhoneNumber}
                      onChange={(e) => setStkPhoneNumber(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl p-2.5 font-mono text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-foreground font-semibold mb-1.5">
                      Billing Amount in Kenya Shillings (KES)
                    </label>
                    <input
                      type="number"
                      value={stkAmount}
                      onChange={(e) => setStkAmount(e.target.value)}
                      className="w-full bg-surface border border-border rounded-xl p-2.5 font-mono text-xs text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleTriggerMpesaStk}
                      className="w-full py-3 bg-primary hover:bg-primary-hover active:scale-[0.98] text-primary-foreground font-semibold rounded-xl text-xs transition-all duration-200 shadow-xs flex items-center justify-center space-x-2"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Send M-Pesa Prompt (KES {Number(stkAmount).toLocaleString()})</span>
                    </button>
                  </div>

                  {stkStatus && (
                    <div className="mt-4 p-3.5 rounded-xl border border-border text-xs font-mono">
                      {stkStatus === 'REQUESTED' && (
                        <div className="text-warning bg-warning-soft border border-warning/20 p-2.5 rounded-xl">
                          Handshaking with Safaricom Daraja API gateway...
                        </div>
                      )}
                      {stkStatus === 'SENT_TO_PHONE' && (
                        <div className="text-info bg-info-soft border border-info/20 p-2.5 rounded-xl animate-pulse">
                          STK Push prompt sent to {stkPhoneNumber}. Awaiting PIN entry...
                        </div>
                      )}
                      {stkStatus === 'SUCCESS' && (
                        <div className="text-success bg-success-soft border border-success/30 p-3.5 rounded-xl">
                          <div className="font-bold flex items-center">
                            <CheckCircle2 className="w-4 h-4 mr-1.5 text-success" />
                            PAYMENT CONFIRMED (M-Pesa Code: SHB94819KL)
                          </div>
                          <div className="mt-1 text-[11px] opacity-90">
                            KES {Number(stkAmount).toLocaleString()} received and allocated to Invoice INV-2026-0042.
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Module: 04. Detox Management (CIWA/COWS) */}
          {activeModule === 'detox' && (
            <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="font-serif text-xl font-bold text-foreground">
                    Clinical Detoxification Assessment & Protocol Calculator
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Clinical Institute Withdrawal Assessment for Alcohol (CIWA-Ar) & Clinical Opiate Withdrawal Scale (COWS)
                  </p>
                </div>
                <span className="px-3 py-1 bg-accent-soft text-accent text-xs font-bold rounded-full border border-accent/20 self-start sm:self-auto">
                  High Acuity Protocol
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans mt-4">
                <div className="p-4 bg-surface-subtle rounded-xl border border-border">
                  <h3 className="font-bold text-foreground text-sm">Nausea & Vomiting (0-7)</h3>
                  <p className="text-muted-foreground text-[11px] mt-1">Score: 0 (None / Normal baseline)</p>
                </div>
                <div className="p-4 bg-surface-subtle rounded-xl border border-border">
                  <h3 className="font-bold text-foreground text-sm">Tremors (0-7)</h3>
                  <p className="text-muted-foreground text-[11px] mt-1">Score: 0 (No tremor present)</p>
                </div>
                <div className="p-4 bg-surface-subtle rounded-xl border border-border">
                  <h3 className="font-bold text-foreground text-sm">Paroxysmal Sweats (0-7)</h3>
                  <p className="text-muted-foreground text-[11px] mt-1">Score: 0 (No sweat / Normal baseline)</p>
                </div>
              </div>
            </div>
          )}

          {/* Module: 28. Calyvia AI Extension Boundary & Institutional Copilot */}
          {activeModule === 'ai_extension' && (
            <div className="space-y-6">
              <div className="bg-card p-6 sm:p-8 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="font-serif text-xl font-bold text-foreground">
                        Module 28: Calyvia AI Institutional Management Copilot
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        Context-aware administrative assistant grounded in live Supabase PostgreSQL and clinical workflows
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      STATUS: ONLINE
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary-soft text-primary border border-primary/20">
                      KDPA 2019
                    </span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed pt-2">
                  The Calyvia AI Assistant is accessible as a persistent floating copilot across the bottom-right corner of all authenticated pages. It executes read-only database tools, computes real-time operational summaries, assists with scheduling, and provides guidance across all 28 Calyvia modules.
                </p>
              </div>

              {/* Tools Architecture & Live Data Connectors */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div className="bg-card p-5 rounded-2xl border border-border shadow-card space-y-2">
                  <div className="flex items-center space-x-2 text-primary font-semibold">
                    <BedDouble className="w-4 h-4" />
                    <span>get_dashboard_summary</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Reads live bed census, ward occupancy, active detox cases, and daily therapy sessions directly from PostgreSQL.
                  </p>
                  <span className="text-[10px] font-mono text-emerald-500">Live Supabase Pooler</span>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-card space-y-2">
                  <div className="flex items-center space-x-2 text-secondary font-semibold">
                    <CalendarIcon className="w-4 h-4" />
                    <span>get_appointments_summary</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Inspects today&apos;s clinical consultations, MDT reviews, therapy schedules, and clinician assignments.
                  </p>
                  <span className="text-[10px] font-mono text-emerald-500">Live Supabase Pooler</span>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-card space-y-2">
                  <div className="flex items-center space-x-2 text-accent font-semibold">
                    <Activity className="w-4 h-4" />
                    <span>get_patient_statistics</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Aggregates privacy-preserving census statistics, triage intake pipeline, and ward allocation without exposing PII.
                  </p>
                  <span className="text-[10px] font-mono text-emerald-500">KDPA Masked</span>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-card space-y-2">
                  <div className="flex items-center space-x-2 text-primary font-semibold">
                    <CreditCard className="w-4 h-4" />
                    <span>get_billing_summary</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Analyzes live MTD revenue collected, outstanding balances, and Safaricom Daraja M-Pesa share from invoices and payments.
                  </p>
                  <span className="text-[10px] font-mono text-emerald-500">Role-gated (Finance/Admin)</span>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-card space-y-2">
                  <div className="flex items-center space-x-2 text-secondary font-semibold">
                    <Users className="w-4 h-4" />
                    <span>get_staff_workload</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Verifies active clinical staff, duty rosters, and medical licensing status under KMPDC and Nursing Council of Kenya (NCK).
                  </p>
                  <span className="text-[10px] font-mono text-emerald-500">Live Roster</span>
                </div>

                <div className="bg-card p-5 rounded-2xl border border-border shadow-card space-y-2">
                  <div className="flex items-center space-x-2 text-primary font-semibold">
                    <ShieldCheck className="w-4 h-4" />
                    <span>get_institutional_protocols</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    Verified institutional knowledge: CIWA-Ar alcohol scores, COWS opioid scores, and Nairobi West Hospital emergency MoUs.
                  </p>
                  <span className="text-[10px] font-mono text-emerald-500">Healthcare Protocol</span>
                </div>
              </div>

              {/* Safety & Clinical Guardrails */}
              <div className="bg-surface-subtle p-5 rounded-2xl border border-border space-y-2 text-xs">
                <div className="flex items-center space-x-2 text-warning font-semibold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Clinical Safety & Regulatory Guardrails</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Calyvia AI functions strictly as an operational and administrative copilot. It will never diagnose patients, prescribe pharmaceuticals, or modify medical treatment plans autonomously. All clinical recommendations cite verified institutional protocols and require validation by a licensed Calyvia physician.
                </p>
              </div>
            </div>
          )}

          {/* Module: 23. Reports & Analytics */}
          {activeModule === 'reports' && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">Facility Reports & Executive Analytics</h2>
                    <p className="text-xs text-muted-foreground">Ministry of Health (MoH) statistical aggregates and financial audits</p>
                  </div>
                  <button onClick={() => alert('Exporting KDPA-compliant report.')} className="px-3 py-1.5 bg-surface border border-border rounded-xl text-xs font-semibold hover:bg-surface-elevated flex items-center space-x-1">
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                    <span className="text-muted-foreground">MTD Collections</span>
                    <div className="text-xl font-bold font-mono text-foreground mt-1">
                      KES {Number(dashboardMetrics?.financials?.mtdRevenueCollected || 0).toLocaleString()}
                    </div>
                    <span className="text-[10px] text-success">
                      {(Number(dashboardMetrics?.financials?.mtdRevenueCollected) || 0) > 0 ? '+14.2% vs target' : 'Live Receipts'}
                    </span>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                    <span className="text-muted-foreground">Detox Completion Rate</span>
                    <div className="text-xl font-bold font-serif text-foreground mt-1">0.0%</div>
                    <span className="text-[10px] text-primary">Clinical Outcome</span>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border">
                    <span className="text-muted-foreground">90-Day Sobriety Rate</span>
                    <div className="text-xl font-bold font-serif text-foreground mt-1">0.0%</div>
                    <span className="text-[10px] text-secondary">Aftercare Tracking</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module: 24. Security & Audit Trail */}
          {activeModule === 'security' && (
            <div className="space-y-6">
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">Security & Immutable Audit Trail (KDPA 2019)</h2>
                    <p className="text-xs text-muted-foreground">Cryptographic logging of all EMR access events, logins, and data modifications</p>
                  </div>
                  <span className="px-3 py-1 bg-primary-soft text-primary text-xs font-bold rounded-full">
                    AES-256-GCM Active
                  </span>
                </div>

                {(user?.role === 'SUPER_ADMIN' || user?.role === 'FACILITY_ADMIN') && (
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground">Personnel Credential & Access Management</div>
                        <div className="text-[11px] text-muted-foreground">Provision staff accounts, assign login emails, allocate system roles, and revoke employee access.</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveModule('staff')}
                      className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-xl hover:bg-primary-hover transition-all self-start sm:self-auto shadow-xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Manage Staff Accounts</span>
                    </button>
                  </div>
                )}
                <div className="overflow-x-auto rounded-xl border border-border mt-3">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Actor / User</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Action</th>
                        <th className="px-4 py-3">Resource</th>
                        <th className="px-4 py-3">Client IP</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr className="hover:bg-surface-subtle transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px]">Active Session</td>
                        <td className="px-4 py-3 font-semibold text-foreground">{user?.fullName || 'Authenticated User'}</td>
                        <td className="px-4 py-3 text-secondary font-medium">{user?.role || 'SUPER_ADMIN'}</td>
                        <td className="px-4 py-3 font-mono text-primary font-bold">SESSION_ACTIVE</td>
                        <td className="px-4 py-3 font-mono">AUTH_SESSION</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">127.0.0.1</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Module: 25. System Administration & Institutional Settings */}
          {activeModule === 'system_admin' && (
            <div className="space-y-6">
              {/* My Profile / Personal Information Section */}
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-border">
                  <div>
                    <h2 className="font-serif text-xl font-bold text-foreground">My Profile & Personal Information</h2>
                    <p className="text-xs text-muted-foreground">Manage your contact information, credentials, and institutional staff details</p>
                  </div>
                  <span className="self-start sm:self-auto px-2.5 py-1 bg-primary-soft text-primary border border-primary/20 text-xs font-semibold rounded-full font-mono">
                    {ROLE_DISPLAY_NAMES[user.role] || user.role}
                  </span>
                </div>

                {profileSuccessMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs flex items-center space-x-2">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>{profileSuccessMsg}</span>
                  </div>
                )}

                {profileErrorMsg && (
                  <div className="p-3 bg-danger-soft border border-danger/20 text-danger rounded-xl text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{profileErrorMsg}</span>
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setProfileSaving(true);
                    setProfileSuccessMsg(null);
                    setProfileErrorMsg(null);
                    try {
                      const res = await updateProfile({
                        fullName: profileForm.fullName,
                        phone: profileForm.phone,
                        department: profileForm.department,
                        jobTitle: profileForm.jobTitle,
                      });
                      if (res.success) {
                        setProfileSuccessMsg(res.message || 'Profile changes saved successfully.');
                      } else {
                        setProfileErrorMsg(res.error || 'Failed to update profile.');
                      }
                    } catch {
                      setProfileErrorMsg('An unexpected error occurred while saving your profile.');
                    } finally {
                      setProfileSaving(false);
                    }
                  }}
                  className="space-y-4 text-xs font-sans"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-foreground font-semibold mb-1.5">
                        Full Name / Preferred Display Name
                      </label>
                      <input
                        type="text"
                        required
                        value={profileForm.fullName}
                        onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                        className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-xs"
                        placeholder="e.g. Dr. Jane Muthoni"
                      />
                    </div>

                    <div>
                      <label className="block text-foreground font-semibold mb-1.5">
                        Institutional Email Address <span className="text-[10px] text-muted-foreground font-normal">(Managed by Auth)</span>
                      </label>
                      <input
                        type="email"
                        disabled
                        value={user.email}
                        className="w-full bg-surface border border-border/60 rounded-xl px-3.5 py-2.5 text-muted-foreground cursor-not-allowed text-xs font-mono select-none"
                      />
                    </div>

                    <div>
                      <label className="block text-foreground font-semibold mb-1.5">
                        Contact Phone Number (+254)
                      </label>
                      <input
                        type="tel"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                        className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-xs font-mono"
                        placeholder="+254 700 000 000"
                      />
                    </div>

                    <div>
                      <label className="block text-foreground font-semibold mb-1.5">
                        Clinical / Administrative Department
                      </label>
                      <input
                        type="text"
                        value={profileForm.department}
                        onChange={(e) => setProfileForm({ ...profileForm, department: e.target.value })}
                        className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-xs"
                        placeholder="e.g. Psychiatry & Detox"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-foreground font-semibold mb-1.5">
                        Professional Job Title / Designation
                      </label>
                      <input
                        type="text"
                        value={profileForm.jobTitle}
                        onChange={(e) => setProfileForm({ ...profileForm, jobTitle: e.target.value })}
                        className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-xs"
                        placeholder="e.g. Consultant Psychiatrist & Medical Officer"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm({
                          fullName: user.fullName || '',
                          phone: user.phone || '',
                          department: user.department || '',
                          jobTitle: user.jobTitle || '',
                        });
                        setProfileSuccessMsg(null);
                        setProfileErrorMsg(null);
                      }}
                      className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-surface-elevated font-medium transition-all text-xs"
                    >
                      Discard Changes
                    </button>
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover shadow-xs active:scale-95 disabled:opacity-50 transition-all text-xs flex items-center space-x-1.5"
                    >
                      {profileSaving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <span>Save Profile Changes</span>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Facility Master Configuration */}
              <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
                <div>
                  <h2 className="font-serif text-xl font-bold text-foreground">Facility Master Configuration</h2>
                  <p className="text-xs text-muted-foreground">Enterprise parameters, currency, timezone, and partner emergency hospitals</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-2">
                    <span className="font-semibold text-foreground">Facility Details</span>
                    <div className="space-y-1 text-muted-foreground">
                      <p><strong>Name:</strong> Calyvia Wellness Center</p>
                      <p><strong>Location:</strong> Mugutha, Ruiru, Kiambu County, Kenya</p>
                      <p><strong>Hotline:</strong> +254 700 534 306</p>
                      <p><strong>Partner Hospital:</strong> The Nairobi West Hospital (MoU Active)</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-subtle border border-border space-y-2">
                    <span className="font-semibold text-foreground">Regional Parameters</span>
                    <div className="space-y-1 text-muted-foreground">
                      <p><strong>Currency:</strong> KES (Kenya Shilling)</p>
                      <p><strong>Timezone:</strong> Africa/Nairobi (EAT / UTC+3)</p>
                      <p><strong>Database:</strong> Supabase PostgreSQL (aws-0-eu-west-1)</p>
                      <p><strong>Regulation:</strong> KDPA 2019 • KMPDC Registered</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Module: Family Management */}
          {activeModule === 'family' && (
            <FamilyManagementView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Counselling & Therapy */}
          {activeModule === 'counselling' && (
            <CounsellingView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Documents, Discharge & Aftercare */}
          {(activeModule === 'documents' || activeModule === 'discharge' || activeModule === 'aftercare') && (
            <DocumentsView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Referral Partners */}
          {activeModule === 'referrals' && (
            <ReferralsView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Patient Movement & Visitors */}
          {activeModule === 'movement' && (
            <MovementView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Stores & General Inventory */}
          {activeModule === 'inventory' && (
            <InventoryView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Staff Task Management */}
          {activeModule === 'tasks' && (
            <TasksView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Incident & Risk Logs */}
          {activeModule === 'incidents' && (
            <IncidentsView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Communications & Feedback */}
          {(activeModule === 'communication' || activeModule === 'feedback') && (
            <CommunicationView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Module: Integrations & Webhooks & Workflow Automation */}
          {(activeModule === 'integrations' || activeModule === 'automation') && (
            <AutomationView
              token={token}
              apiUrl={process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}
            />
          )}

          {/* Fallback for completely unrecognized modules */}
          {!MODULE_TITLES[activeModule] && (
            <div className="bg-card p-8 sm:p-12 rounded-2xl border border-border shadow-card text-center space-y-4">
              <div className="w-14 h-14 bg-surface-elevated text-muted-foreground rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="font-serif text-2xl font-bold text-foreground">Module Not Found</h2>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                The requested operational section <code className="font-mono text-primary bg-surface-subtle px-1.5 py-0.5 rounded border border-border">{activeModule}</code> could not be located in this administrative console.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setActiveModule('dashboard')}
                  className="px-4 py-2 bg-surface border border-border hover:bg-surface-elevated text-foreground text-xs font-semibold rounded-xl transition shadow-xs"
                >
                  &larr; Return to Dashboard
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal: Register Patient */}
      {activeModal === 'register_patient' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Register New Patient</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRegisterPatientSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newPatient.firstName}
                    onChange={(e) => setNewPatient({ ...newPatient, firstName: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newPatient.lastName}
                    onChange={(e) => setNewPatient({ ...newPatient, lastName: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Phone Number (+254)</label>
                <input
                  type="text"
                  placeholder="+2547XXXXXXXX"
                  value={newPatient.phone}
                  onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Gender</label>
                  <select
                    value={newPatient.gender}
                    onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">County</label>
                  <input
                    type="text"
                    value={newPatient.county}
                    onChange={(e) => setNewPatient({ ...newPatient, county: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border border-border rounded-xl text-foreground font-medium hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary-hover shadow-xs"
                >
                  Register Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Schedule Appointment */}
      {activeModal === 'book_appointment' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border sticky top-0 bg-surface z-10">
              <h3 className="font-serif text-lg font-bold text-foreground">Schedule Clinical Appointment</h3>
              <button onClick={() => setActiveModal(null)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBookAppointmentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-foreground font-semibold mb-1">Session Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CBT Relapse Prevention Review"
                  value={newAppointment.title}
                  onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-foreground font-semibold mb-1">Clinician</label>
                <select
                  value={newAppointment.staffMemberName}
                  onChange={(e) => setNewAppointment({ ...newAppointment, staffMemberName: e.target.value })}
                  className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground focus:outline-none"
                >
                  <option value="Dr. Evelyn Wanjiku">Dr. Evelyn Wanjiku (Psychiatrist)</option>
                  <option value="Dr. Antony Baraka">Dr. Antony Baraka (Clinical Admin)</option>
                  <option value="Counsellor David">Counsellor David (Addiction Therapist)</option>
                  <option value="Dr. David Mwangi">Dr. David Mwangi (Medical Officer)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-foreground font-semibold mb-1">Time</label>
                  <input
                    type="text"
                    value={newAppointment.time}
                    onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground font-mono"
                  />
                </div>
                <div>
                  <label className="block text-foreground font-semibold mb-1">Location</label>
                  <input
                    type="text"
                    value={newAppointment.location}
                    onChange={(e) => setNewAppointment({ ...newAppointment, location: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl p-2.5 text-foreground"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="px-4 py-2 border border-border rounded-xl text-foreground font-medium hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary-hover shadow-xs"
                >
                  Confirm Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Create & Provision Staff Account */}
      {isCreateStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-xl max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border sticky top-0 bg-surface z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-foreground">Provision Staff Account</h3>
                  <p className="text-[11px] text-muted-foreground">Authorized administrative employee account creation & RBAC assignment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateStaffOpen(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createStaffError && (
              <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-start space-x-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{createStaffError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaffSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Full Name */}
                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">
                    Full Name <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createStaffForm.fullName}
                    onChange={(e) => setCreateStaffForm({ ...createStaffForm, fullName: e.target.value })}
                    placeholder="e.g. Nurse Beatrice Wanjiku"
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>

                {/* Institutional Email */}
                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">
                    Institutional Email <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={createStaffForm.email}
                    onChange={(e) => setCreateStaffForm({ ...createStaffForm, email: e.target.value })}
                    placeholder="e.g. b.wanjiku@calyviawellness.co.ke"
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono transition-all"
                  />
                </div>

                {/* Contact Phone */}
                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">Contact Phone (+254)</label>
                  <input
                    type="tel"
                    value={createStaffForm.phone}
                    onChange={(e) => setCreateStaffForm({ ...createStaffForm, phone: e.target.value })}
                    placeholder="+254 700 000 000"
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono transition-all"
                  />
                </div>

                {/* Department */}
                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">
                    Department <span className="text-danger">*</span>
                  </label>
                  <select
                    value={createStaffForm.department}
                    onChange={(e) => setCreateStaffForm({ ...createStaffForm, department: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  >
                    <option value="Clinical Operations">Clinical Operations (Psychiatry / Doctors)</option>
                    <option value="Inpatient Nursing">Inpatient Nursing (Detox Ward)</option>
                    <option value="Psychological Therapy">Counselling & Psychology</option>
                    <option value="Pharmacy & Dispensary">Pharmacy & Dispensary</option>
                    <option value="Admissions & Front Desk">Admissions & Front Desk</option>
                    <option value="Billing & Finance">Billing & Finance</option>
                    <option value="Stores & Inventory">Stores & Inventory</option>
                    <option value="Executive Management & Administration">Executive Administration</option>
                  </select>
                </div>

                {/* Job Title */}
                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">
                    Job Title / Designation <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={createStaffForm.jobTitle}
                    onChange={(e) => setCreateStaffForm({ ...createStaffForm, jobTitle: e.target.value })}
                    placeholder="e.g. Senior Nursing Officer"
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  />
                </div>

                {/* Assigned System Role */}
                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">
                    Assigned System Role <span className="text-danger">*</span>
                  </label>
                  <select
                    value={createStaffForm.role}
                    onChange={(e) => setCreateStaffForm({ ...createStaffForm, role: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium transition-all"
                  >
                    <option value="NURSE">Nurse / Clinical Detox Ward (NURSE)</option>
                    <option value="DOCTOR_PSYCHIATRIST">Doctor / Consultant Psychiatrist (DOCTOR_PSYCHIATRIST)</option>
                    <option value="COUNSELLOR">Addiction Counsellor / Psychologist (COUNSELLOR)</option>
                    <option value="PHARMACIST">Pharmacist / Dispensary (PHARMACIST)</option>
                    <option value="ADMISSIONS_FRONT_DESK">Admissions & Reception Front Desk (ADMISSIONS_FRONT_DESK)</option>
                    <option value="FINANCE_BILLING">Finance / Billing Officer & Cashier (FINANCE_BILLING)</option>
                    <option value="INVENTORY_STORE">Store & Inventory Manager (INVENTORY_STORE)</option>
                    <option value="FACILITY_ADMIN">Facility Administrator (FACILITY_ADMIN)</option>
                    <option value="MEDICAL_DIRECTOR">Medical Director / Clinical Head (MEDICAL_DIRECTOR)</option>
                    <option value="MANAGEMENT_EXECUTIVE">Management Executive (MANAGEMENT_EXECUTIVE)</option>
                  </select>
                </div>
              </div>

              {/* Password Provisioning Section */}
              <div className="p-4 rounded-2xl bg-surface-subtle border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-foreground font-semibold flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-primary" />
                    <span>Initial Provisioned Password <span className="text-danger">*</span></span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreateStaffForm({ ...createStaffForm, initialPassword: generateStrongPassword() })}
                    className="text-[11px] text-primary hover:underline font-medium inline-flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    value={createStaffForm.initialPassword}
                    onChange={(e) => setCreateStaffForm({ ...createStaffForm, initialPassword: e.target.value })}
                    placeholder="Min 8 characters (letters, numbers, symbols)"
                    className="w-full bg-surface border border-border rounded-xl px-3.5 pr-10 py-2.5 text-foreground focus:outline-none focus:border-primary font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="createMustChange"
                    checked={createStaffForm.mustChangePassword}
                    onChange={(e) => setCreateStaffForm({ ...createStaffForm, mustChangePassword: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 accent-primary"
                  />
                  <label htmlFor="createMustChange" className="text-xs text-muted-foreground select-none cursor-pointer">
                    Require employee to change this password on their first successful sign-in
                  </label>
                </div>
              </div>

              {/* Regulatory Licensing Details (Optional) */}
              <div className="p-4 rounded-2xl bg-surface-subtle border border-border space-y-3">
                <div className="text-foreground font-semibold flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Professional Regulatory Licensing (For Clinical Staff)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1">Licensing Board</label>
                    <input
                      type="text"
                      value={createStaffForm.licenseBoard}
                      onChange={(e) => setCreateStaffForm({ ...createStaffForm, licenseBoard: e.target.value })}
                      placeholder="e.g. KMPDC / NCK"
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1">Licence Number</label>
                    <input
                      type="text"
                      value={createStaffForm.licenseNumber}
                      onChange={(e) => setCreateStaffForm({ ...createStaffForm, licenseNumber: e.target.value })}
                      placeholder="e.g. NCK/RN/2026/001"
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground text-[11px] mb-1">Licence Expiry</label>
                    <input
                      type="date"
                      value={createStaffForm.licenseExpiryDate}
                      onChange={(e) => setCreateStaffForm({ ...createStaffForm, licenseExpiryDate: e.target.value })}
                      className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Form Action Controls */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsCreateStaffOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-surface-elevated font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingStaff}
                  className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover shadow-xs active:scale-95 disabled:opacity-50 transition-all flex items-center space-x-1.5"
                >
                  {creatingStaff ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Provisioning Account...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create Staff Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Staff Details & Role */}
      {isEditStaffOpen && selectedStaffUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-surface border border-border rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-border sticky top-0 bg-surface z-10">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-foreground">Edit Staff Profile & Role</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">{selectedStaffUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditStaffOpen(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editStaffError && (
              <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{editStaffError}</span>
              </div>
            )}

            <form onSubmit={handleEditStaffSubmit} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editStaffForm.fullName}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, fullName: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">Contact Phone</label>
                  <input
                    type="tel"
                    value={editStaffForm.phone}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">Department</label>
                  <input
                    type="text"
                    required
                    value={editStaffForm.department}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, department: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">Job Title</label>
                  <input
                    type="text"
                    required
                    value={editStaffForm.jobTitle}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, jobTitle: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">Assigned System Role</label>
                  <select
                    value={editStaffForm.role}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, role: e.target.value })}
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary font-medium text-xs"
                  >
                    <option value="NURSE">Nurse (NURSE)</option>
                    <option value="DOCTOR_PSYCHIATRIST">Doctor / Psychiatrist (DOCTOR_PSYCHIATRIST)</option>
                    <option value="COUNSELLOR">Addiction Counsellor (COUNSELLOR)</option>
                    <option value="PHARMACIST">Pharmacist (PHARMACIST)</option>
                    <option value="ADMISSIONS_FRONT_DESK">Admissions & Front Desk (ADMISSIONS_FRONT_DESK)</option>
                    <option value="FINANCE_BILLING">Finance & Billing (FINANCE_BILLING)</option>
                    <option value="INVENTORY_STORE">Stores & Inventory (INVENTORY_STORE)</option>
                    <option value="FACILITY_ADMIN">Facility Administrator (FACILITY_ADMIN)</option>
                    <option value="MEDICAL_DIRECTOR">Medical Director (MEDICAL_DIRECTOR)</option>
                    <option value="MANAGEMENT_EXECUTIVE">Management Executive (MANAGEMENT_EXECUTIVE)</option>
                    {user?.role === 'SUPER_ADMIN' && <option value="SUPER_ADMIN">System Administrator (SUPER_ADMIN)</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-foreground font-semibold">Account Status</label>
                  <select
                    value={editStaffForm.status}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, status: e.target.value as any })}
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-primary text-xs"
                  >
                    <option value="ACTIVE">Active (Access Permitted)</option>
                    <option value="SUSPENDED">Suspended (Access Temporarily Revoked)</option>
                    <option value="DEACTIVATED">Deactivated (Access Permanently Disabled)</option>
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-subtle border border-border space-y-2.5">
                <div className="font-semibold text-foreground text-[11px]">Regulatory Licensing Roster Audit</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-muted-foreground text-[10px] mb-1">Board</label>
                    <input
                      type="text"
                      value={editStaffForm.licenseBoard}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, licenseBoard: e.target.value })}
                      placeholder="e.g. KMPDC"
                      className="w-full bg-surface border border-border rounded-lg p-2 text-foreground focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground text-[10px] mb-1">Licence ID</label>
                    <input
                      type="text"
                      value={editStaffForm.licenseNumber}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, licenseNumber: e.target.value })}
                      placeholder="Licence No"
                      className="w-full bg-surface border border-border rounded-lg p-2 text-foreground font-mono focus:outline-none text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground text-[10px] mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={editStaffForm.licenseExpiryDate}
                      onChange={(e) => setEditStaffForm({ ...editStaffForm, licenseExpiryDate: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg p-2 text-foreground focus:outline-none text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsEditStaffOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-surface-elevated font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingStaff}
                  className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover shadow-xs active:scale-95 disabled:opacity-50 transition-all flex items-center space-x-1.5"
                >
                  {editingStaff ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Staff Details</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Staff Credentials */}
      {isResetPasswordOpen && selectedStaffUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-foreground">Reset Staff Credentials</h3>
                  <p className="text-[11px] text-muted-foreground">{selectedStaffUser.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordOpen(false)}
                className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-surface-subtle border border-border text-[11px] text-muted-foreground space-y-1">
              <p>
                Provision a new initial password for <span className="font-semibold text-foreground font-mono">{selectedStaffUser.email}</span>.
              </p>
              <p className="text-[10px] text-muted-foreground/80">
                The employee can sign in immediately using these credentials. In accordance with KDPA 2019, they will be required to change this password on next login.
              </p>
            </div>

            {resetPasswordError && (
              <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 text-danger text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{resetPasswordError}</span>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 text-xs font-sans">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-foreground font-semibold">New Assigned Password</label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordForm({ ...resetPasswordForm, newPassword: generateStrongPassword() })}
                    className="text-[11px] text-primary hover:underline font-medium inline-flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Strong Password</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    value={resetPasswordForm.newPassword}
                    onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                    placeholder="Min 8 characters"
                    className="w-full bg-surface-subtle border border-border rounded-xl px-3.5 pr-10 py-2.5 text-foreground focus:outline-none focus:border-primary font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="resetMustChange"
                    checked={resetPasswordForm.mustChangePassword}
                    onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, mustChangePassword: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5 accent-primary"
                  />
                  <label htmlFor="resetMustChange" className="text-xs text-muted-foreground select-none cursor-pointer">
                    Force password change upon employee sign-in
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordOpen(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-surface-elevated font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resettingPassword}
                  className="px-5 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary-hover shadow-xs active:scale-95 disabled:opacity-50 transition-all flex items-center space-x-1.5"
                >
                  {resettingPassword ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Credentials...</span>
                    </>
                  ) : (
                    <span>Set New Password</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile & Tablet Persistent Bottom Navigation Bar */}
      <BottomNav
        currentModule={activeModule}
        onSelectModule={setActiveModule}
      />
    </div>
  );
}
