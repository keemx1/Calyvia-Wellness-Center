import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  BedDouble,
  CheckCircle2,
  DoorOpen,
  Plus,
  RefreshCw,
  UserPlus,
  X,
} from 'lucide-react';

interface RoomsViewProps {
  token: string | null;
  apiUrl: string;
}

interface Allocation {
  id: string;
  admissionId: string;
  admissionNumber: string;
  patientId: string | null;
  patientName: string;
  phone: string | null;
  allocatedAt: string;
}

interface Bed {
  id: string;
  roomId: string;
  bedNumber: string;
  status: string;
  dailyRate: number;
  isActive: boolean;
  allocation: Allocation | null;
}

interface Room {
  id: string;
  roomNumber: string;
  roomName: string;
  roomType: string;
  floor: string;
  wing: string;
  isActive: boolean;
  beds: Bed[];
}

interface Admission {
  id: string;
  admissionNumber: string;
  admissionType: string;
  programType: string;
  isActive: boolean;
  primaryDiagnosis?: string;
  patient?: { firstName: string; lastName: string; phone: string | null; status: string } | null;
}

interface Patient {
  id: string;
  calyviaId?: string;
  firstName?: string;
  lastName?: string;
  status?: string;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  DETOX_WARD: 'Detox Ward (High Acuity)',
  INPATIENT_MALE: 'Inpatient Ward (Male)',
  INPATIENT_FEMALE: 'Inpatient Ward (Female)',
  VIP_PRIVATE: 'VIP Private Suite',
  HIGH_DEPENDENCY_UNIT: 'High Dependency Unit',
};

const ROOM_TYPE_OPTIONS = Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => ({ value, label }));

const ADMISSION_TYPE_OPTIONS = [
  { value: 'VOLUNTARY', label: 'Voluntary' },
  { value: 'FAMILY_ESCORTED', label: 'Family Escorted' },
  { value: 'MEDICAL_TRANSFER', label: 'Medical Transfer' },
  { value: 'COURT_ORDERED', label: 'Court Ordered' },
];

const PROGRAM_TYPE_OPTIONS = [
  { value: 'DETOX_ONLY', label: 'Detox Only' },
  { value: 'REHAB_30_DAYS', label: 'Rehab — 30 Days' },
  { value: 'REHAB_60_DAYS', label: 'Rehab — 60 Days' },
  { value: 'REHAB_90_DAYS', label: 'Rehab — 90 Days' },
  { value: 'OUTPATIENT', label: 'Outpatient' },
  { value: 'AFTERCARE_ONLY', label: 'Aftercare Only' },
];

const INPUT =
  'w-full bg-surface-subtle border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground transition-all';
const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-foreground text-xs font-semibold rounded-xl transition-all disabled:opacity-50';
const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-elevated border border-border text-foreground text-xs font-semibold rounded-xl transition-all disabled:opacity-50';

export const RoomsView: React.FC<RoomsViewProps> = ({ token, apiUrl }) => {
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [rooms, setRooms] = useState<Room[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [addBedRoom, setAddBedRoom] = useState<Room | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ room: Room; bed: Bed } | null>(null);
  const [transferTarget, setTransferTarget] = useState<{ bed: Bed; allocation: Allocation } | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<{ bed: Bed; allocation: Allocation } | null>(null);
  const [admitOpen, setAdmitOpen] = useState(false);

  // Forms
  const [roomForm, setRoomForm] = useState({
    roomNumber: '',
    roomName: '',
    roomType: 'DETOX_WARD',
    wing: '',
    floor: 'Ground',
  });
  const [bedForm, setBedForm] = useState({ bedNumber: '', dailyRate: '' });
  const [assignAdmissionId, setAssignAdmissionId] = useState('');
  const [transferForm, setTransferForm] = useState({ newBedId: '', transferReason: '' });
  const [admitForm, setAdmitForm] = useState({
    patientId: '',
    programType: 'REHAB_30_DAYS',
    admissionType: 'VOLUNTARY',
    primaryDiagnosis: '',
    referringDoctor: '',
  });

  const showError = (text: string) => setMsg({ type: 'error', text });
  const showSuccess = (text: string) => setMsg({ type: 'success', text });

  const fetchAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [roomsRes, admRes, patRes] = await Promise.all([
        fetch(`${apiUrl}/rooms`, { headers: authHeaders }),
        fetch(`${apiUrl}/crm/admissions`, { headers: authHeaders }),
        fetch(`${apiUrl}/patients`, { headers: authHeaders }),
      ]);
      if (roomsRes.ok) {
        const data = await roomsRes.json();
        if (Array.isArray(data)) setRooms(data);
      }
      if (admRes.ok) {
        const data = await admRes.json();
        if (Array.isArray(data)) setAdmissions(data);
      }
      if (patRes.ok) {
        const data = await patRes.json();
        if (Array.isArray(data)) setPatients(data);
      }
    } catch {
      showError('Network error loading facility data.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiUrl]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const post = async (path: string, body?: unknown): Promise<any> => {
    const res = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: authHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || `Request failed (${res.status})`);
    }
    return data;
  };

  const closeModals = () => {
    setRoomModalOpen(false);
    setAddBedRoom(null);
    setAssignTarget(null);
    setTransferTarget(null);
    setReleaseTarget(null);
    setAdmitOpen(false);
    setBedForm({ bedNumber: '', dailyRate: '' });
    setAssignAdmissionId('');
    setTransferForm({ newBedId: '', transferReason: '' });
    setAdmitForm({
      patientId: '',
      programType: 'REHAB_30_DAYS',
      admissionType: 'VOLUNTARY',
      primaryDiagnosis: '',
      referringDoctor: '',
    });
  };

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      const success = await action();
      showSuccess(success);
      closeModals();
      await fetchAll();
    } catch (err: any) {
      showError(err?.message || 'Operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleCreateRoom = () =>
    run(async () => {
      if (!roomForm.roomNumber.trim() || !roomForm.roomName.trim() || !roomForm.wing.trim()) {
        throw new Error('Room number, name and wing are required.');
      }
      await post('/rooms', roomForm);
      return `Room ${roomForm.roomNumber.trim()} created.`;
    });

  const handleAddBed = () =>
    run(async () => {
      if (!addBedRoom || !bedForm.bedNumber.trim()) throw new Error('Bed number is required.');
      await post(`/rooms/${addBedRoom.id}/beds`, {
        bedNumber: bedForm.bedNumber.trim(),
        dailyRate: bedForm.dailyRate ? Number(bedForm.dailyRate) : undefined,
      });
      return `Bed ${bedForm.bedNumber.trim()} added to ${addBedRoom.roomName}.`;
    });

  const handleAllocate = () =>
    run(async () => {
      if (!assignTarget) throw new Error('No bed selected.');
      if (!assignAdmissionId) throw new Error('Select the admission episode to assign.');
      await post('/rooms/allocations', {
        bedId: assignTarget.bed.id,
        admissionId: assignAdmissionId,
      });
      return `${assignTarget.bed.bedNumber} assigned to the selected admission.`;
    });

  const handleAdmitAndAssign = () =>
    run(async () => {
      if (!assignTarget) throw new Error('No bed selected.');
      if (!admitForm.patientId) throw new Error('Select the patient to admit.');
      if (!admitForm.primaryDiagnosis.trim()) throw new Error('Primary diagnosis is required.');
      const admission = await post('/crm/admissions', {
        ...admitForm,
        primaryDiagnosis: admitForm.primaryDiagnosis.trim(),
      });
      if (!admission?.id) throw new Error('Admission did not return an id.');
      await post('/rooms/allocations', {
        bedId: assignTarget.bed.id,
        admissionId: admission.id,
      });
      return `Patient admitted and assigned to ${assignTarget.bed.bedNumber}.`;
    });

  const handleTransfer = () =>
    run(async () => {
      if (!transferTarget) throw new Error('No allocation selected.');
      if (!transferForm.newBedId) throw new Error('Select the target bed.');
      if (!transferForm.transferReason.trim()) throw new Error('A transfer reason is required.');
      await post('/rooms/transfers', {
        currentAllocationId: transferTarget.allocation.id,
        newBedId: transferForm.newBedId,
        transferReason: transferForm.transferReason.trim(),
      });
      return `Transferred to the new bed.`;
    });

  const handleRelease = () =>
    run(async () => {
      if (!releaseTarget) throw new Error('No allocation selected.');
      await post(`/rooms/allocations/${releaseTarget.allocation.id}/release`);
      return `${releaseTarget.bed.bedNumber} released and now available.`;
    });

  // Derived board stats
  const allBeds = rooms.flatMap((r) => r.beds);
  const occupiedBeds = allBeds.filter((b) => b.status === 'OCCUPIED' || b.allocation).length;
  const activeAdmissions = admissions.filter((a) => a.isActive);
  const freeBeds = allBeds.filter((b) => !b.allocation && b.status === 'AVAILABLE');
  const admissionLabel = (a: Admission) =>
    `${a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : 'Unknown'} — ${a.admissionNumber}`;
  const patientLabel = (p: Patient) =>
    `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.calyviaId || p.id;

  const modalShell = (title: string, subtitle: string, children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={closeModals} />
      <div className="relative bg-card border border-border rounded-2xl shadow-card w-full max-w-lg p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <button onClick={closeModals} className="p-1 hover:opacity-70 transition-opacity" title="Close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header + stats */}
      <div className="bg-card p-6 rounded-2xl border border-border shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-serif text-xl font-bold text-foreground">Facility & Patient Flow</h2>
            <p className="text-xs text-muted-foreground">
              Real rooms and beds from your database — assign, transfer and release patients
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono font-semibold text-primary">
              {occupiedBeds}/{allBeds.length} Beds Occupied
            </div>
            <button onClick={fetchAll} disabled={loading} className={BTN_SECONDARY} title="Refresh">
              <RefreshCw className={`w-3.5 h-3.5 text-primary ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button onClick={() => setRoomModalOpen(true)} className={BTN_PRIMARY}>
              <Plus className="w-3.5 h-3.5" />
              Add Room
            </button>
          </div>
        </div>

        {msg && (
          <div
            className={`flex items-center justify-between gap-2 p-3 rounded-xl border text-xs ${
              msg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                : 'bg-danger-soft border-danger/20 text-danger'
            }`}
          >
            <div className="flex items-center gap-2">
              {msg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
            <button onClick={() => setMsg(null)} className="p-1 hover:opacity-75 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {activeAdmissions.length === 0 && (
          <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-xs text-amber-600">
            No active admissions yet — open any free bed and use <b>Admit & assign</b> to create one.
            A patient must have an active admission before a bed can be allocated.
          </div>
        )}
      </div>

      {/* Ward board */}
      {rooms.length === 0 && !loading ? (
        <div className="bg-card p-10 rounded-2xl border border-border shadow-card text-center space-y-3">
          <DoorOpen className="w-8 h-8 mx-auto text-muted-foreground" />
          <div className="text-sm font-semibold text-foreground">No rooms yet</div>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Create your first room (e.g. Detox Ward), add beds to it, then admit patients into beds.
            The dashboard census fills in from here.
          </p>
          <button onClick={() => setRoomModalOpen(true)} className={`${BTN_PRIMARY} mx-auto`}>
            <Plus className="w-3.5 h-3.5" />
            Create the first room
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rooms.map((room) => {
            const occupied = room.beds.filter((b) => b.allocation || b.status === 'OCCUPIED').length;
            return (
              <div
                key={room.id}
                className="p-4 rounded-xl bg-surface-subtle border border-border space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-foreground text-sm">
                      {ROOM_TYPE_LABELS[room.roomType] || room.roomName}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {room.wing} · {room.roomName} ({room.roomNumber}) · Floor {room.floor}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${occupied > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {occupied}/{room.beds.length}
                    </span>
                    <button
                      onClick={() => {
                        setBedForm({ bedNumber: '', dailyRate: '' });
                        setAddBedRoom(room);
                      }}
                      className={BTN_SECONDARY}
                      title="Add bed to this room"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Bed
                    </button>
                  </div>
                </div>

                {room.beds.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground p-3 rounded-lg bg-surface border border-border text-center">
                    No beds in this room yet — click <b>+ Bed</b> to add one.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {room.beds.map((bed) => {
                      const isOccupied = !!bed.allocation || bed.status === 'OCCUPIED';
                      return (
                        <div
                          key={bed.id}
                          className={`p-2 rounded-lg border text-center space-y-1 ${
                            isOccupied
                              ? 'bg-primary-soft border-primary/20'
                              : bed.status === 'MAINTENANCE'
                                ? 'bg-amber-500/10 border-amber-500/20'
                                : 'bg-surface border-border'
                          }`}
                        >
                          <div className="font-mono font-semibold text-foreground flex items-center justify-center gap-1">
                            <BedDouble className="w-3 h-3" />
                            {bed.bedNumber}
                          </div>
                          {isOccupied && bed.allocation ? (
                            <>
                              <div className="text-[10px] text-primary font-semibold truncate" title={bed.allocation.patientName}>
                                {bed.allocation.patientName}
                              </div>
                              <div className="flex gap-1 justify-center pt-0.5">
                                <button
                                  onClick={() => {
                                    setTransferTarget({ bed, allocation: bed.allocation! });
                                    setTransferForm({ newBedId: '', transferReason: '' });
                                  }}
                                  className="text-[9px] font-semibold text-foreground hover:underline"
                                  title="Transfer to another bed"
                                >
                                  Transfer
                                </button>
                                <span className="text-muted-foreground">·</span>
                                <button
                                  onClick={() => setReleaseTarget({ bed, allocation: bed.allocation! })}
                                  className="text-[9px] font-semibold text-danger hover:underline"
                                  title="Release bed"
                                >
                                  Release
                                </button>
                              </div>
                            </>
                          ) : isOccupied ? (
                            <div className="text-[10px] text-amber-600">{bed.status}</div>
                          ) : (
                            <button
                              onClick={() => {
                                setAssignTarget({ room, bed });
                                setAdmitOpen(false);
                                setAssignAdmissionId(activeAdmissions[0]?.id || '');
                              }}
                              className="text-[10px] font-semibold text-primary hover:underline w-full"
                            >
                              Assign
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create room modal */}
      {roomModalOpen &&
        modalShell('Create Room', 'Rooms group beds into wards for the occupancy board.', (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Room Number *</label>
                <input
                  className={INPUT}
                  value={roomForm.roomNumber}
                  onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })}
                  placeholder="e.g. R-101"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Floor</label>
                <input
                  className={INPUT}
                  value={roomForm.floor}
                  onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })}
                  placeholder="Ground"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Room Name *</label>
              <input
                className={INPUT}
                value={roomForm.roomName}
                onChange={(e) => setRoomForm({ ...roomForm, roomName: e.target.value })}
                placeholder="e.g. Horizon Room 1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Room Type *</label>
                <select
                  className={INPUT}
                  value={roomForm.roomType}
                  onChange={(e) => setRoomForm({ ...roomForm, roomType: e.target.value })}
                >
                  {ROOM_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Wing *</label>
                <input
                  className={INPUT}
                  value={roomForm.wing}
                  onChange={(e) => setRoomForm({ ...roomForm, wing: e.target.value })}
                  placeholder="e.g. Horizon Wing"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeModals} className={BTN_SECONDARY}>
                Cancel
              </button>
              <button onClick={handleCreateRoom} disabled={busy} className={BTN_PRIMARY}>
                <Plus className="w-3.5 h-3.5" />
                {busy ? 'Creating…' : 'Create Room'}
              </button>
            </div>
          </div>
        ))}

      {/* Add bed modal */}
      {addBedRoom &&
        modalShell('Add Bed', `${addBedRoom.roomName} (${addBedRoom.roomNumber})`, (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Bed Number *</label>
                <input
                  className={INPUT}
                  value={bedForm.bedNumber}
                  onChange={(e) => setBedForm({ ...bedForm, bedNumber: e.target.value })}
                  placeholder="e.g. B1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Daily Rate (KES)</label>
                <input
                  className={INPUT}
                  value={bedForm.dailyRate}
                  onChange={(e) => setBedForm({ ...bedForm, dailyRate: e.target.value })}
                  placeholder="5000"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeModals} className={BTN_SECONDARY}>
                Cancel
              </button>
              <button onClick={handleAddBed} disabled={busy} className={BTN_PRIMARY}>
                <Plus className="w-3.5 h-3.5" />
                {busy ? 'Adding…' : 'Add Bed'}
              </button>
            </div>
          </div>
        ))}

      {/* Assign (or admit + assign) modal */}
      {assignTarget &&
        modalShell(
          `Assign ${assignTarget.bed.bedNumber}`,
          `${assignTarget.room.roomName} · ${ROOM_TYPE_LABELS[assignTarget.room.roomType] || ''}`,
          admitOpen ? (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-primary/20 bg-primary-soft text-xs text-primary">
                Admit a patient, then place them straight into {assignTarget.bed.bedNumber}.
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Patient *</label>
                <select
                  className={INPUT}
                  value={admitForm.patientId}
                  onChange={(e) => setAdmitForm({ ...admitForm, patientId: e.target.value })}
                >
                  <option value="">Select patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {patientLabel(p)} {p.status ? `(${p.status})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Program *</label>
                  <select
                    className={INPUT}
                    value={admitForm.programType}
                    onChange={(e) => setAdmitForm({ ...admitForm, programType: e.target.value })}
                  >
                    {PROGRAM_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Admission Type *</label>
                  <select
                    className={INPUT}
                    value={admitForm.admissionType}
                    onChange={(e) => setAdmitForm({ ...admitForm, admissionType: e.target.value })}
                  >
                    {ADMISSION_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Primary Diagnosis *</label>
                <input
                  className={INPUT}
                  value={admitForm.primaryDiagnosis}
                  onChange={(e) => setAdmitForm({ ...admitForm, primaryDiagnosis: e.target.value })}
                  placeholder="e.g. Alcohol dependence syndrome, severe"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Referring Doctor</label>
                <input
                  className={INPUT}
                  value={admitForm.referringDoctor}
                  onChange={(e) => setAdmitForm({ ...admitForm, referringDoctor: e.target.value })}
                  placeholder="e.g. Dr. Kevin Kiprotich"
                />
              </div>
              <div className="flex justify-between gap-2 pt-1">
                <button onClick={() => setAdmitOpen(false)} className={BTN_SECONDARY}>
                  Back
                </button>
                <button onClick={handleAdmitAndAssign} disabled={busy} className={BTN_PRIMARY}>
                  <UserPlus className="w-3.5 h-3.5" />
                  {busy ? 'Admitting…' : 'Admit & Assign Bed'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  Active admission episode *
                </label>
                <select
                  className={INPUT}
                  value={assignAdmissionId}
                  onChange={(e) => setAssignAdmissionId(e.target.value)}
                >
                  <option value="">Select admission…</option>
                  {activeAdmissions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {admissionLabel(a)}
                    </option>
                  ))}
                </select>
              </div>
              {activeAdmissions.length === 0 && (
                <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-[11px] text-amber-600">
                  No active admissions available. Admit the patient first — the bed can only be
                  allocated to an open admission episode.
                </div>
              )}
              <div className="flex justify-between gap-2 pt-1">
                <button onClick={() => setAdmitOpen(true)} className={BTN_SECONDARY}>
                  <UserPlus className="w-3.5 h-3.5" />
                  New admission…
                </button>
                <div className="flex gap-2">
                  <button onClick={closeModals} className={BTN_SECONDARY}>
                    Cancel
                  </button>
                  <button
                    onClick={handleAllocate}
                    disabled={busy || !assignAdmissionId}
                    className={BTN_PRIMARY}
                  >
                    <BedDouble className="w-3.5 h-3.5" />
                    {busy ? 'Assigning…' : 'Assign Bed'}
                  </button>
                </div>
              </div>
            </div>
          ),
        )}

      {/* Transfer modal */}
      {transferTarget &&
        modalShell(
          `Transfer ${transferTarget.bed.bedNumber}`,
          `${transferTarget.allocation.patientName} · ${transferTarget.allocation.admissionNumber}`,
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Target bed *</label>
              <select
                className={INPUT}
                value={transferForm.newBedId}
                onChange={(e) => setTransferForm({ ...transferForm, newBedId: e.target.value })}
              >
                <option value="">Select available bed…</option>
                {freeBeds
                  .filter((b) => b.id !== transferTarget.bed.id)
                  .map((b) => {
                    const room = rooms.find((r) => r.id === b.roomId);
                    return (
                      <option key={b.id} value={b.id}>
                        {b.bedNumber} — {room?.roomName || room?.wing || ''}
                      </option>
                    );
                  })}
              </select>
              {freeBeds.filter((b) => b.id !== transferTarget.bed.id).length === 0 && (
                <p className="text-[11px] text-amber-600 mt-1">
                  No other free beds — create a room/bed first.
                </p>
              )}
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Reason *</label>
              <input
                className={INPUT}
                value={transferForm.transferReason}
                onChange={(e) => setTransferForm({ ...transferForm, transferReason: e.target.value })}
                placeholder="e.g. Step-down from detox to inpatient"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeModals} className={BTN_SECONDARY}>
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={busy || !transferForm.newBedId || !transferForm.transferReason.trim()}
                className={BTN_PRIMARY}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {busy ? 'Transferring…' : 'Transfer'}
              </button>
            </div>
          </div>
        )}

      {/* Release modal */}
      {releaseTarget &&
        modalShell(
          `Release ${releaseTarget.bed.bedNumber}?`,
          `${releaseTarget.allocation.patientName} · ${releaseTarget.allocation.admissionNumber}`,
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              This closes the active allocation and returns the bed to <b>AVAILABLE</b>. The
              admission episode stays open until it is discharged separately.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={closeModals} className={BTN_SECONDARY}>
                Cancel
              </button>
              <button onClick={handleRelease} disabled={busy} className={BTN_PRIMARY}>
                <CheckCircle2 className="w-3.5 h-3.5" />
                {busy ? 'Releasing…' : 'Release Bed'}
              </button>
            </div>
          </div>
        )}
    </div>
  );
};
