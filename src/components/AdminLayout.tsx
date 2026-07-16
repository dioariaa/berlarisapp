import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, LayoutDashboard, LogOut, Menu, ScrollText, ShieldCheck, Users, X } from 'lucide-react'
import type { AuthUser } from '../types'

interface AdminLayoutProps {
  children: ReactNode
  activePage: 'dashboard' | 'employees' | 'leaves' | 'users' | 'audit'
  onNavigate: (page: 'dashboard' | 'employees' | 'leaves' | 'users' | 'audit') => void
  user: AuthUser
  onLogout: () => void
}

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard, page: 'dashboard' as const },
  { label: 'Data Karyawan', icon: Users, page: 'employees' as const },
  { label: 'Data Cuti', icon: CalendarDays, page: 'leaves' as const },
  { label: 'Audit Log', icon: ScrollText, page: 'audit' as const, superadminOnly: true },
  { label: 'Manajemen User', icon: ShieldCheck, page: 'users' as const, superadminOnly: true },
]

export function AdminLayout({ children, activePage, onNavigate, user, onLogout }: AdminLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    const closeOnDesktop = () => {
      if (window.innerWidth > 760) setMobileOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', closeOnDesktop)
    document.body.classList.toggle('drawer-open', mobileOpen)
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', closeOnDesktop)
      document.body.classList.remove('drawer-open')
    }
  }, [mobileOpen])

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`} aria-label="Sidebar BerlarisApp">
        <div className="brand">
          <div className="brand__mark">
          </div>
          <div>
            <strong>Berlaris</strong>
            <span>Kopi &amp; Resto · Admin</span>
          </div>
          <button className="icon-button sidebar__close" onClick={() => setMobileOpen(false)} aria-label="Tutup menu">
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Navigasi utama">
          <span className="sidebar__label">UTAMA</span>
          {navigation.filter((item) => !item.superadminOnly || user.role === 'superadmin').map(({ label, icon: Icon, page }) => (
            <button
              key={label}
              className={`nav-item ${page === activePage ? 'nav-item--active' : ''}`}
              onClick={() => {
                onNavigate(page)
                setMobileOpen(false)
              }}
            >
              <Icon size={19} strokeWidth={page === activePage ? 2.3 : 1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="admin-profile">
            <div className="avatar avatar--admin">{initials(user.name)}</div>
            <div>
              <strong>{user.name}</strong>
              <span>{user.role === 'superadmin' ? 'Superadmin' : 'Admin'}</span>
            </div>
            <button className="profile-logout" onClick={onLogout} aria-label="Keluar"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Tutup sidebar" />}

      <div className="main-panel">
        <header className="topbar">
          <button className="icon-button topbar__menu" onClick={() => setMobileOpen(true)} aria-label="Buka menu">
            <Menu size={22} />
          </button>
          <div className="topbar__context">
            <img className="topbar__brand-mark" src="/berlaris-mark.png" alt="" aria-hidden="true" />
            <span>BerlarisApp</span>
            <span>/</span>
            <strong>{pageLabel(activePage)}</strong>
          </div>
          <div className="topbar__right">
            <div className="topbar__date">
              <CalendarDays size={17} />
              <span>
                {new Intl.DateTimeFormat('id-ID', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date())}
              </span>
            </div>
            <div className="topbar-user"><div><strong>{user.name}</strong><span>{user.role}</span></div><div className="avatar avatar--small">{initials(user.name)}</div></div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function pageLabel(page: AdminLayoutProps['activePage']) {
  return {
    dashboard: 'Dashboard',
    employees: 'Data Karyawan',
    leaves: 'Data Cuti',
    users: 'Manajemen User',
    audit: 'Audit Log',
  }[page]
}
