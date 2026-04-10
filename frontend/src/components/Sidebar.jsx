import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  {
    section: 'Overview',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      )},
    ]
  },
  {
    section: 'Servers',
    items: [
      { to: '/servers', label: 'Game Servers', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="4" rx="1"/><rect x="2" y="10" width="20" height="4" rx="1"/><rect x="2" y="17" width="20" height="4" rx="1"/></svg>
      )},
    ]
  },
  {
    section: 'Admin',
    items: [
      { to: '/settings', label: 'Settings', icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
      )},
    ]
  }
];

export default function Sidebar({ serverCount, runningCount }) {
  const location = useLocation();

  return (
    <aside className="gsm-sidebar">
      {NAV_ITEMS.map(section => (
        <div key={section.section}>
          <div className="nav-section-label">{section.section}</div>
          {section.items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              active={location.pathname === item.to}
              badge={
                item.to === '/servers' && runningCount > 0
                  ? { label: runningCount, className: 'green' }
                  : null
              }
            />
          ))}
          <div className="sidebar-divider" />
        </div>
      ))}
    </aside>
  );
}

function NavLink({ to, label, icon, active, badge }) {
  const navigate = useNavigate();
  return (
    <div className={`nav-item ${active ? 'active' : ''}`} onClick={() => navigate(to)}>
      {icon}
      <span>{label}</span>
      {badge && <span className={`nav-badge ${badge.className || ''}`}>{badge.label}</span>}
    </div>
  );
}
