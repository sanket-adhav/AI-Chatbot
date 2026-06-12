import { useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './components/chat/Sidebar'
import ChatPage from './pages/ChatPage'
import ConfigPage from './pages/ConfigPage'
import DashboardPage from './pages/DashboardPage'
import AgentPage from './pages/AgentPage'
import AuthPage from './pages/AuthPage'
import AdminPage from './pages/AdminPage'
import ErrorBoundary from './components/common/ErrorBoundary'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { useAuth } from './hooks/useAuth'
import './styles/global.css'
import './styles/dashboard.css'
import './styles/model-selector.css'

function AppShell() {
    const navigate = useNavigate()
    const location = useLocation()
    const { authed, user, logout, updateUser } = useAuth()
    const [sidebarRefresh, setSidebarRefresh] = useState(0)
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

    // Slide state: 'landing' | 'sliding' | 'chat'
    const [view, setView] = useState('landing')

    const chatMatch = location.pathname.match(/^\/chat\/(\d+)/)
    const activeConvId = chatMatch ? Number(chatMatch[1]) : null

    const handleAuth = (loggedInUser) => {
        const u = loggedInUser || user
        if (u?.role === 'admin') {
            navigate('/admin')
        } else {
            setView('landing')
            navigate('/')
        }
    }

    const handleLogout = () => {
        logout()
        setView('landing')
        navigate('/')
    }

    const handleStartChat = (conv) => {
        setView('sliding')
        setSidebarRefresh(r => r + 1)
        setTimeout(() => {
            navigate(`/chat/${conv.id}`)
            setView('chat')
        }, 380)
    }

    const handleNewChat = () => setView('landing')

    const handleProfileUpdated = (updatedUser) => {
        updateUser(updatedUser)
    }

    const isNonChatRoute = location.pathname === '/config' || location.pathname === '/dashboard'

    // ── Auth Guard ────────────────────────────────────────────────────────────
    if (!authed) {
        return <AuthPage onAuth={handleAuth} />
    }

    if (user?.role === 'admin') {
        return (
            <div className="app-layout" style={{ background: 'var(--bg-base)' }}>
                <Routes>
                    <Route path="/admin" element={<AdminPage onLogout={handleLogout} />} />
                    <Route path="*" element={<AdminPage onLogout={handleLogout} />} />
                </Routes>
            </div>
        )
    }

    return (
        <div className="app-layout">
            {/* LANDING SCREEN — slides out left */}
            {(view === 'landing' || view === 'sliding') && !isNonChatRoute && (
                <div className={`landing-slide-wrapper ${view === 'sliding' ? 'slide-out-left' : ''}`}>
                    <AgentPage onStartChat={handleStartChat} onLogout={handleLogout} />
                </div>
            )}

            {/* CHAT LAYOUT — slides in from right */}
            {(view === 'chat' || isNonChatRoute) && (
                <div className={`chat-slide-wrapper ${view === 'chat' ? 'slide-in-right' : ''}`}>
                    <Sidebar
                        onNewChat={handleNewChat}
                        onLogout={handleLogout}
                        activeConvId={activeConvId}
                        refresh={sidebarRefresh}
                        isCollapsed={isSidebarCollapsed}
                        setIsCollapsed={setIsSidebarCollapsed}
                        onProfileUpdated={handleProfileUpdated}
                    />
                    <main className={`main-area ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                        <Routes>
                            <Route path="/" element={<ChatPage user={user} />} />
                            <Route path="/chat/:convId" element={<ChatPage user={user} onRefreshSidebar={() => setSidebarRefresh(r => r + 1)} />} />
                            <Route path="/config" element={<ConfigPage />} />
                            <Route path="/dashboard" element={<DashboardPage />} />
                        </Routes>
                    </main>
                </div>
            )}
        </div>
    )
}

export default function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <ThemeProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/*" element={<AppShell />} />
                        </Routes>
                    </BrowserRouter>
                </ThemeProvider>
            </AuthProvider>
        </ErrorBoundary>
    )
}
