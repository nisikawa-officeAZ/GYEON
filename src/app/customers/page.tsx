"use client";

import { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerList from "@/components/customers/CustomerList";
import { Customer } from "@/types/customer";

export default function CustomersPage() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | undefined>();

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto">
        <PageTitle title="Customers" subtitle="顧客管理" />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left — Form */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              {selectedCustomer ? "Edit Customer" : "New Customer"}
            </p>
            <CustomerForm />
          </div>

          {/* Right — List */}
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
              Customer List
            </p>
            <CustomerList
              selectedId={selectedCustomer?.id}
              onSelect={setSelectedCustomer}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
