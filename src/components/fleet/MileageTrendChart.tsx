"use client";

import * as React from "react";
import { TrendingUp, Fuel, Calendar, Car, ArrowUpRight, ArrowDownRight, Info } from "lucide-react";
import { MileageDataPoint } from "@/lib/fleet/fuel-calculations";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";

interface MileageTrendChartProps {
  dataPoints: MileageDataPoint[];
  vehicles: Array<{ id: string; vehicleNumber: string; make: string; model: string }>;
  selectedVehicleId?: string;
  onVehicleChange?: (vehicleId: string) => void;
}

export function MileageTrendChart({
  dataPoints,
  vehicles,
  selectedVehicleId,
  onVehicleChange,
}: MileageTrendChartProps) {
  const [selectedPoint, setSelectedPoint] = React.useState<MileageDataPoint | null>(null);

  // Filter valid data points that have calculated mileage
  const validPoints = React.useMemo(() => {
    return dataPoints
      .filter((p) => p.mileageKmPerLitre != null && p.mileageKmPerLitre > 0)
      .sort((a, b) => new Date(a.fuelDate).getTime() - new Date(b.fuelDate).getTime());
  }, [dataPoints]);

  const vehicleOptions = React.useMemo(() => {
    const opts = [{ value: "ALL", label: "All Company Vehicles" }];
    vehicles.forEach((v) => {
      opts.push({
        value: v.id,
        label: `${v.vehicleNumber} (${v.make} ${v.model})`,
      });
    });
    return opts;
  }, [vehicles]);

  if (validPoints.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-[#0B1E36] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#F26522]" />
              Fleet Fuel Mileage &amp; Efficiency Trend
            </h3>
            <p className="text-xs text-slate-500">
              Chronological KM/L efficiency per refill between full-tank entries
            </p>
          </div>
          <div className="w-64">
            <SearchableCombobox
              options={vehicleOptions}
              value={selectedVehicleId || "ALL"}
              onChange={(val) => onVehicleChange?.(val === "ALL" ? "" : val)}
              placeholder="Filter by vehicle..."
            />
          </div>
        </div>

        <div className="py-12 text-center text-slate-400 space-y-2">
          <Fuel className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-sm font-medium">Insufficient mileage data for trend visualization</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            At least 2 chronological full-tank fuel entries with recorded odometer readings are required to calculate distance and mileage.
          </p>
        </div>
      </div>
    );
  }

  // Calculate statistics
  const mileageValues = validPoints.map((p) => p.mileageKmPerLitre!);
  const minMileage = Math.min(...mileageValues);
  const maxMileage = Math.max(...mileageValues);
  const avgMileage = mileageValues.reduce((sum, v) => sum + v, 0) / mileageValues.length;
  const latestMileage = validPoints[validPoints.length - 1].mileageKmPerLitre!;

  // SVG dimensions
  const width = 800;
  const height = 220;
  const padLeft = 45;
  const padRight = 20;
  const padTop = 25;
  const padBottom = 35;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const yMin = Math.max(0, Math.floor(minMileage * 0.8));
  const yMax = Math.ceil(maxMileage * 1.15);
  const yRange = yMax - yMin || 1;

  const getX = (index: number) => {
    if (validPoints.length === 1) return padLeft + chartW / 2;
    return padLeft + (index / (validPoints.length - 1)) * chartW;
  };

  const getY = (val: number) => {
    return padTop + chartH - ((val - yMin) / yRange) * chartH;
  };

  const pointsString = validPoints
    .map((p, idx) => `${getX(idx)},${getY(p.mileageKmPerLitre!)}`)
    .join(" ");

  const areaPointsString = `${padLeft},${padTop + chartH} ${pointsString} ${getX(
    validPoints.length - 1
  )},${padTop + chartH}`;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
      {/* Header with Title and Vehicle Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#F26522] flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#0B1E36]">
              Fleet Fuel Mileage &amp; Efficiency Trend
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-orange-100 text-[#F26522]">
              KM/L
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real daily fuel efficiency calculated from actual odometer progressions between refills
          </p>
        </div>

        <div className="w-full sm:w-64">
          <SearchableCombobox
            options={vehicleOptions}
            value={selectedVehicleId || "ALL"}
            onChange={(val) => onVehicleChange?.(val === "ALL" ? "" : val)}
            placeholder="Filter by vehicle..."
          />
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
        <div>
          <span className="text-slate-400 font-medium">Latest Refill Mileage</span>
          <div className="text-base font-bold font-mono text-[#0B1E36] mt-0.5">
            {latestMileage.toFixed(2)} km/L
          </div>
        </div>
        <div>
          <span className="text-slate-400 font-medium">Average Efficiency</span>
          <div className="text-base font-bold font-mono text-[#F26522] mt-0.5">
            {avgMileage.toFixed(2)} km/L
          </div>
        </div>
        <div>
          <span className="text-slate-400 font-medium">Best Recorded</span>
          <div className="text-base font-bold font-mono text-emerald-600 mt-0.5">
            {maxMileage.toFixed(2)} km/L
          </div>
        </div>
        <div>
          <span className="text-slate-400 font-medium">Lowest Recorded</span>
          <div className="text-base font-bold font-mono text-slate-700 mt-0.5">
            {minMileage.toFixed(2)} km/L
          </div>
        </div>
      </div>

      {/* SVG Line Chart */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none"
          style={{ minWidth: "550px" }}
        >
          <defs>
            <linearGradient id="mileageGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F26522" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#F26522" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
            const yVal = yMin + pct * yRange;
            const yPos = getY(yVal);
            return (
              <g key={i}>
                <line
                  x1={padLeft}
                  y1={yPos}
                  x2={width - padRight}
                  y2={yPos}
                  stroke="#E2E8F0"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padLeft - 6}
                  y={yPos + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94A3B8"
                  fontFamily="monospace"
                >
                  {yVal.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          <polygon points={areaPointsString} fill="url(#mileageGradient)" />

          {/* Trend line */}
          <polyline
            points={pointsString}
            fill="none"
            stroke="#F26522"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Interactive Data points */}
          {validPoints.map((point, idx) => {
            const cx = getX(idx);
            const cy = getY(point.mileageKmPerLitre!);
            const isSelected = selectedPoint?.id === point.id;

            return (
              <g key={point.id} className="cursor-pointer" onClick={() => setSelectedPoint(point)}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isSelected ? 6 : 4}
                  fill={isSelected ? "#0B1E36" : "#FFFFFF"}
                  stroke="#F26522"
                  strokeWidth={isSelected ? 3 : 2}
                  className="transition-all hover:r-6"
                />
                {/* Date label at bottom */}
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#94A3B8"
                  className="hidden sm:block"
                >
                  {new Date(point.fuelDate).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                  })}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Active Data Point Inspection Panel */}
      {selectedPoint && (
        <div className="bg-[#0B1E36] text-white p-4 rounded-xl text-xs space-y-2 relative animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
            <div className="font-bold text-sm text-orange-400 flex items-center gap-2">
              <span>{selectedPoint.vehicleNumber}</span>
              <span className="text-[10px] text-slate-300 font-mono font-normal">
                Refill #{selectedPoint.logNumber} · {new Date(selectedPoint.fuelDate).toLocaleDateString("en-IN")}
              </span>
            </div>
            <button
              onClick={() => setSelectedPoint(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
            <div>
              <span className="text-slate-400 text-[11px] block">Mileage</span>
              <span className="text-emerald-400 font-bold text-sm">
                {selectedPoint.mileageKmPerLitre?.toFixed(2)} km/L
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Distance Covered</span>
              <span className="text-white font-bold text-sm">
                {selectedPoint.distanceKm ? `${selectedPoint.distanceKm.toLocaleString()} km` : "—"}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Fuel Quantity</span>
              <span className="text-white font-bold text-sm">
                {selectedPoint.quantityLitres.toFixed(2)} L @ ₹{selectedPoint.pricePerUnit.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Total Refill Cost</span>
              <span className="text-orange-300 font-bold text-sm">
                ₹{selectedPoint.totalCost.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 pt-1 flex items-center gap-3">
            <span>Odometer: {selectedPoint.odometerReading.toLocaleString()} km</span>
            {selectedPoint.previousOdometer && (
              <span>(Prev: {selectedPoint.previousOdometer.toLocaleString()} km)</span>
            )}
            {selectedPoint.costPerKm && (
              <span>Running Cost: ₹{selectedPoint.costPerKm.toFixed(2)} / km</span>
            )}
            {selectedPoint.stationName && <span>Station: {selectedPoint.stationName}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
