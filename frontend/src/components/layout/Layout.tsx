import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="md:ml-56 mt-14">
        <Suspense fallback={<div className="p-4 md:p-6"><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
