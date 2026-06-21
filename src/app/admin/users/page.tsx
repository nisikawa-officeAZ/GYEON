import UsersAdminClient from "./UsersAdminClient";
export const dynamic = "force-dynamic";
export const metadata = { title: "Users | Admin" };
export default function AdminUsersPage() {
  // Initial data fetched client-side via server actions
  return <UsersAdminClient />;
}
