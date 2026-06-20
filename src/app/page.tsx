import MainLayout from "@/components/layout/MainLayout";
import CustomerVehicleEstimateFlow from "@/components/flow/CustomerVehicleEstimateFlow";

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-xl font-semibold text-slate-100 mb-6">Dashboard</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Vehicles", value: "--" },
            { label: "Active Customers", value: "--" },
            { label: "Estimates", value: "--" },
            { label: "Revenue", value: "--" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-900 border border-slate-800 rounded-lg p-4"
            >
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-200">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Flow */}
        <CustomerVehicleEstimateFlow />
      </div>
    </MainLayout>
  );
}
