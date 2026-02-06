import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      <Sidebar />
      <Header />
      <main className="ml-56 mt-14 p-6">
        <Suspense fallback={<div className="p-6"><div className="animate-pulse h-64 bg-bg-secondary rounded-xl" /></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
