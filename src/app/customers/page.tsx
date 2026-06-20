"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import CustomerSearch from "@/components/customers/CustomerSearch";
import CustomerTable from "@/components/customers/CustomerTable";
import CustomerForm from "@/components/customers/CustomerForm";

export default function CustomersPage() {
  const [showForm, setShowForm] = useState(false);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <PageTitle title="Customers" subtitle="顧客管理" />
          <button
            onClick={() => setShowForm(true)}
            className="shrink-0 bg-[#1d4ed8] hover:bg-[#1e40af] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Customer
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <CustomerSearch />
        </div>

        {/* Table */}
        <CustomerTable />
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-lg bg-[#1e293b] rounded-xl shadow-lg p-6 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-slate-100">New Customer</h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-slate-500 hover:text-slate-100 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <CustomerForm onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </MainLayout>
  );
}
