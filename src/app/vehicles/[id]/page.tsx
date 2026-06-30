import { notFound } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";
import VehicleDetailClient from "@/components/vehicles/VehicleDetailClient";
import { getVehicleById } from "@/lib/vehicles/get-vehicle";
import { getCustomerById } from "@/lib/customers/get-customer";
import { getCustomers } from "@/lib/customers/get-customers";

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const vehicle = await getVehicleById(id);
  if (!vehicle) notFound();

  // Customer ↔ Vehicle relationship verification:
  //   getCustomerById is dealer-scoped, so a resolved owner confirms the vehicle's
  //   customer belongs to the SAME dealer. customers feeds the reassign dropdown.
  const [customers, owner] = await Promise.all([
    getCustomers(),
    vehicle.customer_id ? getCustomerById(vehicle.customer_id) : Promise.resolve(null),
  ]);

  return (
    <MainLayout>
      <VehicleDetailClient vehicle={vehicle} customers={customers} owner={owner} />
    </MainLayout>
  );
}
