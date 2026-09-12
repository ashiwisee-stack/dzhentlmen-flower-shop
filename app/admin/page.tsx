import { AdminPanel } from "@/components/admin-panel";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireAdminPage();
  return <AdminPanel userName={user.displayName} />;
}
