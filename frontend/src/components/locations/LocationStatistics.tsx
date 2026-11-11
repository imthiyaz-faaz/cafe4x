import React from "react";
import { Armchair, Users, Clock } from "lucide-react";
import type { LocationStatisticsData } from "../../services/tableService";

interface LocationStatisticsProps {
  stats: LocationStatisticsData;
}

export const LocationStatistics: React.FC<LocationStatisticsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 mb-6">
      {/* 1. Total Tables */}
      <div className="flex items-center gap-3.5 rounded-3xl border border-[#F4E3D7] bg-[#FDF7F2] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F6DEC9] text-[#A75D28] shadow-xs">
          <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h16" />
            <path d="M4 12h16" />
            <path d="M4 12v6" />
            <path d="M20 12v6" />
          </svg>
        </div>
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-[#8A7667] truncate">Total Tables</span>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-[#342219]">{stats.totalTables}</span>
            <span className="text-[10px] text-[#A8907E] font-medium">/ {stats.tableLimit}</span>
          </div>
        </div>
      </div>

      {/* 2. Total Seats */}
      <div className="flex items-center gap-3.5 rounded-3xl border border-[#EBE4DC] bg-[#FAF8F5] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EADFD5] text-[#70452D] shadow-xs">
          <Armchair className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-[#8A7667] truncate">Total Seats</span>
          <span className="text-xl sm:text-2xl font-black text-[#342219] mt-0.5 block">{stats.totalSeats}</span>
        </div>
      </div>

      {/* 3. Occupied Seats */}
      <div className="flex items-center gap-3.5 rounded-3xl border border-[#D9EFE3] bg-[#F2FAF6] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D2F0E1] text-[#1E7E4E] shadow-xs">
          <Users className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-[#6C897B] truncate">Occupied</span>
          <span className="text-xl sm:text-2xl font-black text-[#1D3B2E] mt-0.5 block">{stats.occupiedSeats}</span>
        </div>
      </div>

      {/* 4. Available Seats */}
      <div className="flex items-center gap-3.5 rounded-3xl border border-[#FEF3C7] bg-[#FFFBEB] p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200">
        <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FDE68A] text-[#B45309] shadow-xs">
          <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0">
          <span className="block text-xs font-semibold text-[#8C7650] truncate">Available</span>
          <span className="text-xl sm:text-2xl font-black text-[#4B3B1B] mt-0.5 block">{stats.availableSeats}</span>
        </div>
      </div>

      {/* 5. Occupancy Percentage with Gauge */}
      <div className="col-span-2 md:col-span-1 flex items-center justify-between rounded-3xl border border-[#EEE5DC] bg-white p-4 sm:p-5 shadow-2xs hover:shadow-md transition-all duration-200">
        <div className="flex items-center gap-3.5">
          {/* Circular mini gauge */}
          <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-[#EFE7DE]"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#8C5835]"
                strokeDasharray={`${stats.occupancyPercentage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[11px] font-black text-[#342219]">
              {stats.occupancyPercentage}%
            </span>
          </div>

          <div className="min-w-0">
            <span className="block text-xs font-semibold text-[#8A7667] truncate">Occupancy</span>
            <span className="text-xs font-bold text-[#70452D] mt-0.5 block">
              {stats.occupiedSeats} / {stats.totalSeats} Seats
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationStatistics;
