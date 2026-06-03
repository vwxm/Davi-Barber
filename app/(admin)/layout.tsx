import { redirect } from 'next/navigation'
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

  // Defense-in-depth: even if middleware is bypassed, never render the admin
  // shell for a non-admin.
  if (!user || user.app_metadata?.role !== 'admin') {
    redirect('/admin/login')
  }

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
