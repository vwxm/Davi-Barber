import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopBar } from '@/components/admin/AdminTopBar'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userName =
    (user?.user_metadata?.name as string | undefined) ??
    user?.email ??
    'Admin'

  return (
    <div className="min-h-screen bg-zinc-900 flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <AdminTopBar userName={userName} />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
