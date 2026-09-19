import MainLayout from "@/components/layout/MainLayout";
import LegacyCustomerRegistrationWizard from "@/components/customers/legacy-registration/LegacyCustomerRegistrationWizard";
import { searchDealerCustomersAction } from "@/lib/customers/search-dealer-customers-action";
import {
  findLegacyRegistrationDuplicatesAction,
  getLegacyCustomerVehiclesAction,
  registerLegacyCustomerAction,
} from "@/lib/customers/legacy-registration/actions";

export const metadata = { title: "既存顧客登録 | GYEON Detailer Agent" };

export default function LegacyCustomerRegistrationPage() {
  return (
    <MainLayout>
      <LegacyCustomerRegistrationWizard
        searchCustomers={searchDealerCustomersAction}
        loadCustomerVehicles={getLegacyCustomerVehiclesAction}
        findDuplicates={findLegacyRegistrationDuplicatesAction}
        saveRegistration={registerLegacyCustomerAction}
      />
    </MainLayout>
  );
}
