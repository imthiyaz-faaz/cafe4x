import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { RotateCw, Coffee } from "lucide-react";
import Background from "../../components/background";
import Navbar from "../../components/navbar/navbar";
import LocationHeader from "../../components/locations/LocationHeader";
import LocationStatistics from "../../components/locations/LocationStatistics";
import LocationFilters, { type FilterStatus } from "../../components/locations/LocationFilters";
import TableCard from "../../components/locations/TableCard";
import CreateTableModal from "../../components/locations/CreateTableModal";
import EditTableModal from "../../components/locations/EditTableModal";
import AssignCard from "../../components/locations/assigncard";
import { tableService, type TableItem, type LocationStatisticsData } from "../../services/tableService";
import { locationApi, type LocationItem, type LocationProviderSummary } from "../../services/locations";

export const LocationDetails: React.FC = () => {
  const { locationId, shortCode } = useParams();
  const navigate = useNavigate();

  const [location, setLocation] = useState<LocationItem | null>(null);
  const [tables, setTables] = useState<TableItem[]>([]);
  const [tableLimit, setTableLimit] = useState<number>(5);
  const [locationProviders, setLocationProviders] = useState<LocationProviderSummary[]>([]);
  const [stats, setStats] = useState<LocationStatisticsData>({
    totalTables: 0,
    totalSeats: 0,
    occupiedSeats: 0,
    availableSeats: 0,
    occupancyPercentage: 0,
    tableLimit: 5,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAssignProvidersOpen, setIsAssignProvidersOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);

  const effectiveLocId = locationId || "";

  // Load Location Data, Tables, Providers, and Statistics
  const loadData = async () => {
    if (!effectiveLocId) return;
    setIsLoading(true);
    try {
      const [locRes, tablesRes, statsRes, provRes] = await Promise.all([
        locationApi.getLocationById(effectiveLocId),
        tableService.getTablesByLocation(effectiveLocId),
        tableService.getLocationStatistics(effectiveLocId),
        locationApi.getLocationProviders(effectiveLocId).catch(() => []),
      ]);

      if (locRes) {
        setLocation(locRes);
        if (locRes.assignedProviders && locRes.assignedProviders.length > 0) {
          setLocationProviders(locRes.assignedProviders);
        } else if (Array.isArray(provRes) && provRes.length > 0) {
          setLocationProviders(provRes);
        } else if (locRes.assignedProviderId) {
          setLocationProviders([
            {
              id: locRes.assignedProviderId,
              name: locRes.assignedProviderName || "Assigned Provider",
              email: locRes.assignedProviderEmail || "",
            },
          ]);
        } else {
          setLocationProviders([]);
        }
      } else if (Array.isArray(provRes)) {
        setLocationProviders(provRes);
      }

      if (tablesRes) {
        setTables(tablesRes.tables);
        setTableLimit(tablesRes.tableLimit);
      }
      if (statsRes) setStats(statsRes);
    } catch (err) {
      console.error("Failed to load location details:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveLocId]);

  // Filtered Tables
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      // Search by name
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (!t.name.toLowerCase().includes(q)) return false;
      }

      // Provider filter
      if (providerFilter !== "all") {
        if (t.providerId !== providerFilter) return false;
      }

      // Status filter
      const isOccupied = t.occupiedSeats > 0 && t.occupiedSeats >= t.seatLimit;
      if (statusFilter === "occupied" && !isOccupied) return false;
      if (statusFilter === "available" && isOccupied) return false;

      return true;
    });
  }, [tables, searchQuery, statusFilter, providerFilter]);

  const counts = useMemo(() => {
    let avail = 0;
    let occ = 0;
    tables.forEach((t) => {
      if (t.occupiedSeats > 0 && t.occupiedSeats >= t.seatLimit) {
        occ++;
      } else {
        avail++;
      }
    });
    return {
      all: tables.length,
      available: avail,
      occupied: occ,
    };
  }, [tables]);

  // Handlers
  const handleBack = () => {
    if (shortCode) {
      navigate(`/${shortCode}/location`);
    } else {
      navigate("/location");
    }
  };

  const handleOpenTable = (table: TableItem) => {
    if (shortCode) {
      navigate(`/${shortCode}/admin/location/${effectiveLocId}/table/${table.id}`);
    } else {
      navigate(`/admin/location/${effectiveLocId}/table/${table.id}`);
    }
  };

  const handleCreateTableSubmit = async (data: {
    name: string;
    seatLimit: number;
    isActive: boolean;
    providerId: string;
  }) => {
    await tableService.createTable(effectiveLocId, data);
    await loadData();
  };

  const handleEditTableSubmit = async (
    tableId: number,
    data: { name?: string; seatLimit?: number; isActive?: boolean; providerId?: string }
  ) => {
    await tableService.updateTable(tableId, data);
    await loadData();
  };

  const handleToggleTableStatus = async (table: TableItem) => {
    try {
      await tableService.toggleTableStatus(table.id);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to update table status.");
    }
  };

  const handleDeleteTable = async (table: TableItem) => {
    if (!window.confirm(`Are you sure you want to delete ${table.name}?`)) return;
    try {
      await tableService.deleteTable(table.id);
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || err?.message || "Failed to delete table.");
    }
  };

  const handleSaveProviders = async (updatedLoc: LocationItem) => {
    const providerIds = (updatedLoc.assignedProviders || []).map((p) => p.id);
    await locationApi.assignProvider(updatedLoc.id, {
      assignedProviderId: updatedLoc.assignedProviderId,
      assignedProviderEmail: updatedLoc.assignedProviderEmail,
      assignedProviderName: updatedLoc.assignedProviderName,
      providerIds: providerIds.length > 0 ? providerIds : (updatedLoc.assignedProviderId ? [updatedLoc.assignedProviderId] : []),
    });
    await loadData();
  };

  return (
    <Background>
      <div className="flex min-h-screen flex-col pt-20 text-[#4A3E3D]">
        <Navbar />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20">
          {/* Location Header with Assigned Providers widget */}
          <LocationHeader
            locationName={location?.name || "Location"}
            isActive={location?.status === "Active"}
            assignedProviders={locationProviders}
            onBack={handleBack}
            onCreateTable={() => setIsCreateOpen(true)}
            onEditLocation={() => {
              if (shortCode) {
                navigate(`/${shortCode}/location`);
              } else {
                navigate("/location");
              }
            }}
            onOpenAssignProviders={() => setIsAssignProvidersOpen(true)}
          />

          {/* Location Statistics */}
          <LocationStatistics stats={stats} />

          {/* Search & Filters */}
          <LocationFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            providerFilter={providerFilter}
            onProviderFilterChange={setProviderFilter}
            providers={locationProviders}
            counts={counts}
          />

          {/* Tables Body */}
          {isLoading ? (
            <div className="py-24 text-center">
              <RotateCw className="w-8 h-8 animate-spin mx-auto text-[#8C5835] mb-3" />
              <p className="text-[#8A7667] text-sm font-medium">Loading tables from database...</p>
            </div>
          ) : filteredTables.length === 0 ? (
            <div className="py-20 text-center rounded-3xl border border-[#EEE5DC] bg-white/95 p-8 shadow-xs">
              <div className="w-14 h-14 rounded-3xl bg-[#FAF4ED] text-[#8C5835] flex items-center justify-center mx-auto mb-3">
                <Coffee className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-[#342219]">No Tables Found</h3>
              <p className="text-xs text-[#8A7667] mt-1 max-w-sm mx-auto">
                {tables.length === 0
                  ? "This location doesn't have any tables yet. Click 'Create Table' above to add your first table."
                  : "No tables match the selected filter criteria."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTables.map((t, tIdx) => (
                <TableCard
                  key={t.id ? `tbl-${t.id}` : `tbl-idx-${tIdx}`}
                  table={t}
                  onOpen={handleOpenTable}
                  onEdit={(t) => {
                    setEditingTable(t);
                    setIsEditOpen(true);
                  }}
                  onToggleStatus={handleToggleTableStatus}
                  onDelete={handleDeleteTable}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Create Table Modal */}
      <CreateTableModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateTableSubmit}
        existingTables={tables}
        tableLimit={tableLimit}
        locationProviders={locationProviders}
      />

      {/* Edit Table Modal */}
      <EditTableModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setEditingTable(null);
        }}
        table={editingTable}
        onUpdate={handleEditTableSubmit}
        existingTables={tables}
        locationProviders={locationProviders}
      />

      {/* Assign Providers Modal */}
      {location && (
        <AssignCard
          location={location}
          isOpen={isAssignProvidersOpen}
          onClose={() => setIsAssignProvidersOpen(false)}
          onSave={handleSaveProviders}
        />
      )}
    </Background>
  );
};

export default LocationDetails;
