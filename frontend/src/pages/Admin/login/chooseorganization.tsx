import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Plus, X, Loader2 } from "lucide-react";
import { organizationApi, type Organization } from "../../../services/organizationApi";
import Background from "../../../components/background";
import logoImg from "../../../assets/images/logo.png";

export default function ChooseOrganizationPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [shortCode, setShortCode] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cafe4x_currentUser");
      if (stored) {
        const user = JSON.parse(stored);
        setCurrentUser(user);

        // Fetch organizations for this user
        organizationApi
          .getOrganizations(user.id)
          .then((orgs: Organization[]) => {
            if (orgs && orgs.length > 0) {
              setOrganizations(orgs);
            } else {
              // Fallback to local storage organizations
              loadLocalOrgs(user);
            }
          })
          .catch(() => {
            loadLocalOrgs(user);
          })
          .finally(() => setLoading(false));
      } else {
        navigate("/login");
      }
    } catch {
      navigate("/login");
    }
  }, [navigate]);

  const loadLocalOrgs = (user: any) => {
    try {
      const stored = localStorage.getItem("cafe4x_organizations");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrganizations(parsed);
          return;
        }
      }
    } catch {}

    // If user has organization from signup/credentials
    if (user?.organization) {
      setOrganizations([
        {
          id: user.organizationId || "org_1",
          name: user.organization,
          shortCode: user.shortCode || "ORG",
        },
      ]);
    } else {
      setOrganizations([]);
    }
  };

  const handleSelectOrg = (org: Organization) => {
    // Update active organization on current user
    if (currentUser) {
      const updatedUser = {
        ...currentUser,
        organization: org.name,
        shortCode: org.shortCode.toUpperCase(),
        organizationId: org.id,
      };
      localStorage.setItem("cafe4x_currentUser", JSON.stringify(updatedUser));
    }
    navigate(`/${org.shortCode.toUpperCase()}/landing`);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError("");

    if (!orgName.trim() || !shortCode.trim()) {
      setModalError("Please provide both name and shortCode.");
      return;
    }

    setModalLoading(true);
    const cleanShort = shortCode.trim().toUpperCase();

    try {
      const created = await organizationApi.createOrganization({
        name: orgName.trim(),
        shortCode: cleanShort,
        userId: currentUser?.id,
      });

      const updatedOrgs = [created, ...organizations];
      setOrganizations(updatedOrgs);
      try {
        localStorage.setItem("cafe4x_organizations", JSON.stringify(updatedOrgs));
      } catch {}

      // Reset and close
      setOrgName("");
      setShortCode("");
      setIsModalOpen(false);

      // Navigate to the newly created organization's isolated page
      handleSelectOrg(created);
    } catch (err: any) {
      // Local fallback
      const newOrg: Organization = {
        id: `org_${cleanShort.toLowerCase()}_${Date.now()}`,
        name: orgName.trim(),
        shortCode: cleanShort,
        ownerUserId: currentUser?.id,
      };
      const updatedOrgs = [newOrg, ...organizations];
      setOrganizations(updatedOrgs);
      try {
        localStorage.setItem("cafe4x_organizations", JSON.stringify(updatedOrgs));
      } catch {}

      setOrgName("");
      setShortCode("");
      setIsModalOpen(false);
      handleSelectOrg(newOrg);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <Background>
      <div className="relative min-h-screen w-full flex flex-col items-center justify-start overflow-x-hidden pt-12 pb-16 px-4">
        {/* Logo Card with Framed Cafe4X Logo */}
        <div className="mb-5 flex items-center justify-center">
          <div className="flex h-24 w-20 items-center justify-center rounded-xl border-2 border-[#69391D]/30 bg-white/90 p-2 shadow-lg shadow-[#70452D]/5 backdrop-blur-sm">
            <img
              src={logoImg}
              alt="Cafe4X"
              className="h-16 w-auto object-contain drop-shadow"
            />
          </div>
        </div>

        {/* Small Pill Badge identical to Landing Page */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E9D7C6] bg-white/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#80563C] shadow-sm">
          <span>Your workplace café, simplified</span>
        </div>

        {/* Main Heading styled identical to Landing page: Welcome to / Choose an Organization */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#342219] text-center mb-4">
          Choose an{" "}
          <span className="text-[#8B5738]">
            Organization
            <span className="text-[#C99A6B]">.</span>
          </span>
        </h1>

        {/* Subtitle identical to landing page tone */}
        <p className="mx-auto mb-10 max-w-xl text-center text-base sm:text-lg font-medium text-[#70523E]">
          Where our app is your gateway to happiness
        </p>

        {/* Organizations Grid */}
        {loading ? (
          <div className="flex items-center gap-3 text-[#70523E] py-12">
            <Loader2 className="animate-spin text-[#8B5738]" size={28} />
            <span className="font-semibold text-lg">Loading organizations...</span>
          </div>
        ) : (
          <div className="w-full max-w-5xl">
            {/* Existing Organizations Cards */}
            {organizations.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {organizations.map((org) => (
                  <button
                    key={org.id || org.shortCode}
                    onClick={() => handleSelectOrg(org)}
                    type="button"
                    className="group flex items-center gap-4 bg-white/95 hover:bg-white p-5 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-[#EEE5DC] text-left cursor-pointer"
                  >
                    {/* Dark silhouette avatar box */}
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#32454E] text-white shadow-sm overflow-hidden">
                      <User size={36} className="text-white fill-white translate-y-1" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-[#342219] truncate leading-snug group-hover:text-[#8B5738] transition-colors">
                        {org.name}
                      </h2>
                      <span className="mt-2 inline-block rounded-md bg-[#009FB7] px-2.5 py-0.5 text-xs font-bold text-white uppercase tracking-wider shadow-sm">
                        {org.shortCode}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Section: Create a new organization */}
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-[#80563C] mb-3.5">
                Create a new organization
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button
                  onClick={() => setIsModalOpen(true)}
                  type="button"
                  className="group flex items-center gap-4 bg-white/95 hover:bg-white p-5 rounded-2xl shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-[#EEE5DC] text-left cursor-pointer"
                >
                  {/* Dark silhouette avatar box */}
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#32454E] text-white shadow-sm overflow-hidden">
                    <User size={36} className="text-white fill-white translate-y-1" />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#009FB7] text-white font-bold text-lg leading-none shadow-sm">
                      <Plus size={18} strokeWidth={3} />
                    </span>
                    <span className="text-lg font-bold text-[#342219] group-hover:text-[#8B5738] transition-colors">
                      New Organization
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Organization Create Modal matching screenshot */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-md bg-white shadow-2xl p-6 sm:p-7">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-6">
              <h3 className="text-xl font-bold text-[#342219] font-sans">
                Organization Create
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
              >
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <p className="mb-4 text-xs font-semibold text-red-600">
                {modalError}
              </p>
            )}

            {/* Form */}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-4 items-center gap-3">
                <label
                  htmlFor="org-name"
                  className="col-span-1 text-[15px] font-bold text-[#342219]"
                >
                  name
                </label>
                <input
                  id="org-name"
                  required
                  placeholder="name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="col-span-3 rounded-[3px] border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-[#009bb3] focus:ring-1 focus:ring-[#009bb3]"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-3">
                <label
                  htmlFor="org-shortCode"
                  className="col-span-1 text-[15px] font-bold text-[#342219]"
                >
                  shortCode
                </label>
                <input
                  id="org-shortCode"
                  required
                  placeholder="shortCode"
                  value={shortCode}
                  onChange={(e) =>
                    setShortCode(
                      e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase()
                    )
                  }
                  className="col-span-3 rounded-[3px] border border-gray-300 px-3 py-1.5 text-sm uppercase outline-none focus:border-[#009bb3] focus:ring-1 focus:ring-[#009bb3]"
                />
              </div>

              {/* Action buttons matching screenshot */}
              <div className="flex justify-end items-center gap-2 pt-6">
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="rounded-[3px] border border-[#2E8B57] bg-white px-4 py-1.5 text-sm font-semibold text-[#2E8B57] hover:bg-green-50 transition disabled:opacity-60 cursor-pointer shadow-sm"
                >
                  {modalLoading ? "Saving..." : "Submit"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={modalLoading}
                  className="rounded-[3px] bg-[#C43D43] px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700 transition cursor-pointer shadow-sm"
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Background>
  );
}
