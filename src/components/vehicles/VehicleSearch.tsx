"use client";

import { useState } from "react";

export default function VehicleSearch() {
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [licensePlate, setLicensePlate] = useState("");

  return (
    <div className="bg-[#1e293b] rounded-xl shadow-lg p-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Manufacturer</label>
          <input
            type="text"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            placeholder="Toyota"
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Alphard"
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-400">License Plate</label>
          <input
            type="text"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value)}
            placeholder="品川 300 あ 1234"
            className="bg-[#0f172a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#1d4ed8] transition-colors"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <button className="bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          Search
        </button>
      </div>
    </div>
  );
}
