import { BottomNav } from '@/components/client/BottomNav'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800 px-4 py-3">
        <h1 className="text-lg font-bold text-amber-500">Davi Barber</h1>
      </header>
      <main className="pb-20 px-4 pt-4 max-w-lg mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
