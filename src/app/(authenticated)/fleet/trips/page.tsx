"use client";

import * as React from "react";
import Link from "next/link";
import {
  Compass,
  Plus,
  RefreshCw,
  Search,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Truck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function FleetTripsPage() {
  const [trips, setTrips] = React.useState<any[]>([]);
  const [vehicles, setVehicles] = React.useState<any[]>([]);
  const [drivers, setDrivers] = React.useState<any[]>([]);
  const [deliveryNotes, setDeliveryNotes] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Modals
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [showCompleteModal, setShowCompleteModal] = React.useState(false);
  const [selectedTrip, setSelectedTrip] = React.useState<any>(null);

  // Form states
  const [createForm, setCreateForm] = React.useState({
    vehicleId: "",
    driverId: "",
    startOdometer: 0,
    tripPurpose: "DELIVERY",
    deliveryNoteIds: [] as string[],
    remarks: "",
  });

  const [completeForm, setCompleteForm] = React.useState({
    endOdometer: 0,
    tripExpenses: 0,
    fuelUsedLitres: 0,
    remarks: "",
  });

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [tRes, vRes, dRes, dnRes] = await Promise.all([
        fetch("/api/v1/fleet/trips"),
        fetch("/api/v1/fleet/vehicles?status=ACTIVE"),
        fetch("/api/v1/fleet/drivers?status=ACTIVE"),
        fetch("/api/v1/delivery-notes?status=DISPATCHED"),
      ]);

      const [tData, vData, dData, dnData] = await Promise.all([
        tRes.json(),
        vRes.json(),
        dRes.json(),
        dnRes.json(),
      ]);

      if (tData.success) setTrips(tData.data);
      if (vData.success) setVehicles(vData.data);
      if (dData.success) setDrivers(dData.data);
      if (dnData.success) setDeliveryNotes(dnData.data || []);
    } catch (err) {
      console.error("Failed to load trips data", err);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
  }, []);

  const handleVehicleSelect = (vId: string) => {
    const v = vehicles.find((item) => item.id === vId);
    setCreateForm({
      ...createForm,
      vehicleId: vId,
      driverId: v?.defaultDriverId || createForm.driverId,
      startOdometer: v ? Number(v.currentOdometer) : 0,
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/v1/fleet/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error?.message || "Failed to create trip");
        return;
      }
      setShowCreateModal(false);
      setCreateForm({
        vehicleId: "",
        driverId: "",
        startOdometer: 0,
        tripPurpose: "DELIVERY",
        deliveryNoteIds: [],
        remarks: "",
      });
      loadData();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;
    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch(`/api/v1/fleet/trips/${selectedTrip.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(completeForm),
      });
      const data = await res.json();
      if (!data.success) {
        setFormError(data.error?.message || "Failed to complete trip");
        return;
      }
      setShowCompleteModal(false);
      setSelectedTrip(null);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openCompleteModal = (trip: any) => {
    setSelectedTrip(trip);
    setCompleteForm({
      endOdometer: Number(trip.startOdometer) + 10,
      tripExpenses: 0,
      fuelUsedLitres: 0,
      remarks: "",
    });
    setFormError("");
    setShowCompleteModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/fleet"
              className="text-slate-400 hover:text-slate-600 transition-colors text-xs flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Fleet Overview
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0B1E36]">Vehicle Trips & Delivery Runs</h1>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-slate-100 text-slate-700">
              {trips.length} Total Trips
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Dispatch trip logging, multiple Delivery Note assignment, and odometer distance reconciliation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="border-slate-300 hover:bg-slate-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-[#F26522] hover:bg-[#EA580C] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Trip
          </Button>
        </div>
      </div>

      {/* Trips Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Trip #</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Driver</th>
                <th className="px-4 py-3">Linked DNs</th>
                <th className="px-4 py-3">Start Odo</th>
                <th className="px-4 py-3">End Odo</th>
                <th className="px-4 py-3">Distance</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trips.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-mono font-bold text-[#0B1E36]">{t.tripNumber}</td>
                  <td className="px-4 py-3 text-xs">{new Date(t.tripDate).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{t.vehicle?.vehicleNumber}</td>
                  <td className="px-4 py-3 text-slate-700">{t.driver?.name || "Unassigned"}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold font-mono">
                      {t.deliveryNotes?.length || 0} DNs
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{Number(t.startOdometer).toLocaleString()} km</td>
                  <td className="px-4 py-3 font-mono">{t.endOdometer ? `${Number(t.endOdometer).toLocaleString()} km` : "—"}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-[#F26522]">
                    {t.distanceKm ? `${Number(t.distanceKm).toLocaleString()} km` : "In Transit"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold ${
                        t.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700"
                          : t.status === "IN_TRANSIT"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {t.status === "IN_TRANSIT" && (
                      <Button
                        size="sm"
                        onClick={() => openCompleteModal(t)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Complete
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {trips.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">
                    No trips logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Trip Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-[#0B1E36]">Create Vehicle Trip</h2>
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} className="space-y-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-700">Select Vehicle *</label>
                <select
                  required
                  value={createForm.vehicleId}
                  onChange={(e) => handleVehicleSelect(e.target.value)}
                  className="w-full mt-1 border border-slate-200 rounded-md p-2 text-sm font-semibold"
                >
                  <option value="">-- Choose Company Vehicle --</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicleNumber} ({v.make} {v.model}) - Odo: {Number(v.currentOdometer).toLocaleString()} km
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Driver</label>
                  <select
                    value={createForm.driverId}
                    onChange={(e) => setCreateForm({ ...createForm, driverId: e.target.value })}
                    className="w-full mt-1 border border-slate-200 rounded-md p-2 text-sm"
                  >
                    <option value="">-- Unassigned / None --</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.driverCode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Start Odometer (km) *</label>
                  <Input
                    required
                    type="number"
                    value={createForm.startOdometer}
                    onChange={(e) => setCreateForm({ ...createForm, startOdometer: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Trip Purpose</label>
                <select
                  value={createForm.tripPurpose}
                  onChange={(e) => setCreateForm({ ...createForm, tripPurpose: e.target.value })}
                  className="w-full mt-1 border border-slate-200 rounded-md p-2 text-sm"
                >
                  <option value="DELIVERY">Material Delivery</option>
                  <option value="RETURN_PICKUP">Material Return Pickup</option>
                  <option value="SITE_TRANSFER">Site-to-Site Transfer</option>
                  <option value="MAINTENANCE">Vehicle Maintenance Run</option>
                  <option value="OTHER">Other Purpose</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700">Remarks / Route Notes</label>
                <Input
                  placeholder="e.g. First drop at Site A, return trip from Site B"
                  value={createForm.remarks}
                  onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#0B1E36] hover:bg-[#1E293B] text-white"
                >
                  {isSubmitting ? "Starting..." : "Start Trip"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Trip Modal */}
      {showCompleteModal && selectedTrip && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-[#0B1E36]">Complete Trip {selectedTrip.tripNumber}</h2>
            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1">
              <div><span className="font-semibold">Vehicle:</span> {selectedTrip.vehicle?.vehicleNumber}</div>
              <div><span className="font-semibold">Start Odometer:</span> {Number(selectedTrip.startOdometer).toLocaleString()} km</div>
            </div>
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">
                {formError}
              </div>
            )}
            <form onSubmit={handleComplete} className="space-y-4 text-sm">
              <div>
                <label className="text-xs font-semibold text-slate-700">End Odometer (km) *</label>
                <Input
                  required
                  type="number"
                  min={Number(selectedTrip.startOdometer)}
                  value={completeForm.endOdometer}
                  onChange={(e) => setCompleteForm({ ...completeForm, endOdometer: Number(e.target.value) })}
                  className="mt-1 font-mono font-bold"
                />
                <span className="text-[11px] text-slate-400">
                  Calculated distance: {Math.max(0, completeForm.endOdometer - Number(selectedTrip.startOdometer))} km
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700">Trip Expenses (₹)</label>
                  <Input
                    type="number"
                    value={completeForm.tripExpenses}
                    onChange={(e) => setCompleteForm({ ...completeForm, tripExpenses: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700">Fuel Used (Litres)</label>
                  <Input
                    type="number"
                    value={completeForm.fuelUsedLitres}
                    onChange={(e) => setCompleteForm({ ...completeForm, fuelUsedLitres: Number(e.target.value) })}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCompleteModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSubmitting ? "Finalizing..." : "Complete Trip"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

