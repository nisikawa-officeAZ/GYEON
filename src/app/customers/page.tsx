import MainLayout from "@/components/layout/MainLayout";
import PageTitle from "@/components/ui/PageTitle";
import EmptyState from "@/components/ui/EmptyState";

export default function CustomersPage() {
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto">
        <PageTitle title="Customers" />
        <EmptyState
          message="Coming Soon"
          description="Awaiting GPT CTO Specification"
        />
      </div>
    </MainLayout>
  );
}
