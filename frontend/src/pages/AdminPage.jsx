import { useState, useEffect } from 'react'
import axios from 'axios'
import { getAccessToken } from '../api/client'

const BASE_URL = 'http://localhost:8000'

// --- Premium Corporate Dark Theme Styles ---
const styles = {
    container: {
        display: 'flex',
        width: '100%',
        height: '100vh',
        background: '#0a0a0b',
        color: '#f4f4f5',
        fontFamily: "'Inter', sans-serif",
    },
    sidebar: {
        width: '260px',
        background: '#161618',
        borderRight: '1px solid #27272a',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
    },
    sidebarItem: (active) => ({
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        color: active ? '#fff' : '#a1a1aa',
        background: active ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
        transition: 'all 0.2s ease',
        borderLeft: active ? '3px solid #6366f1' : '3px solid transparent',
    }),
    main: {
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        padding: '40px',
        position: 'relative',
    },
    card: {
        background: '#161618',
        borderRadius: '12px',
        border: '1px solid #27272a',
        padding: '24px',
        marginBottom: '24px',
    },
    badge: (type) => ({
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        background: type === 'admin' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.05)',
        color: type === 'admin' ? '#a78bfa' : '#a1a1aa',
    }),
    statusBadge: (active) => ({
        padding: '4px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 600,
        background: active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        color: active ? '#4ade80' : '#f87171',
    }),
    button: {
        padding: '8px 16px',
        background: '#6366f1',
        color: 'white',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 500,
        transition: 'opacity 0.2s',
    },
    secondaryButton: {
        padding: '8px 16px',
        background: 'rgba(255, 255, 255, 0.05)',
        color: '#f4f4f5',
        border: '1px solid #27272a',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        transition: 'all 0.2s',
    }
}

export default function AdminPage({ onLogout }) {
    const [activeTab, setActiveTab] = useState('overview')
    const [overview, setOverview] = useState(null)
    const [health, setHealth] = useState(null)
    const [users, setUsers] = useState([])
    const [tokenStats, setTokenStats] = useState(null)
    const [settings, setSettings] = useState(null)
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // State for Search/Filters
    const [userSearch, setUserSearch] = useState('')
    const [userStatus, setUserStatus] = useState('all')
    const [userPage, setUserPage] = useState(1)

    const fetchAllData = async () => {
        setLoading(true)
        try {
            const token = getAccessToken()
            const authHeader = { Authorization: `Bearer ${token}` }

            // Initial fetch for Overview
            const overviewRes = await axios.get(`${BASE_URL}/admin/stats`, { headers: authHeader })
            setOverview(overviewRes.data)

            // Depending on active tab, fetch other data
            if (activeTab === 'users') {
                const usersRes = await axios.get(`${BASE_URL}/admin/users?query=${userSearch}&status=${userStatus}&page=${userPage}`, { headers: authHeader })
                setUsers(usersRes.data)
            } else if (activeTab === 'analytics') {
                const [healthRes, tokensRes] = await Promise.all([
                    axios.get(`${BASE_URL}/admin/platform-health`, { headers: authHeader }),
                    axios.get(`${BASE_URL}/admin/token-analytics`, { headers: authHeader })
                ])
                setHealth(healthRes.data)
                setTokenStats(tokensRes.data)
            } else if (activeTab === 'settings') {
                const settingsRes = await axios.get(`${BASE_URL}/admin/settings`, { headers: authHeader })
                setSettings(settingsRes.data)
            } else if (activeTab === 'logs') {
                const logsRes = await axios.get(`${BASE_URL}/admin/logs`, { headers: authHeader })
                setLogs(logsRes.data)
            }

        } catch (err) {
            setError('Auth session expired or insufficient permissions.')
            if (err.response?.status === 403) {
                onLogout()
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAllData()
    }, [activeTab, userSearch, userStatus, userPage])

    const handleToggleSuspension = async (userId) => {
        try {
            const token = getAccessToken()
            const res = await axios.patch(`${BASE_URL}/admin/users/${userId}/suspend`, null, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: res.data.is_suspended } : u))
        } catch (err) {
            alert('Action failed')
        }
    }

    const handleUpdateSettings = async (newSettings) => {
        try {
            const token = getAccessToken()
            const res = await axios.patch(`${BASE_URL}/admin/settings`, newSettings, {
                headers: { Authorization: `Bearer ${token}` }
            })
            setSettings(res.data)
        } catch (err) {
            alert('Update failed')
        }
    }

    const renderOverview = () => (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '40px' }}>
                <div style={styles.card}>
                    <div style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '8px' }}>Active Users (24h)</div>
                    <div style={{ fontSize: '32px', fontWeight: 600 }}>{overview?.total_users || 0}</div>
                </div>
                <div style={styles.card}>
                    <div style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '8px' }}>Total Interactions</div>
                    <div style={{ fontSize: '32px', fontWeight: 600 }}>{overview?.total_messages || 0}</div>
                </div>
                <div style={styles.card}>
                    <div style={{ color: '#a1a1aa', fontSize: '13px', marginBottom: '8px' }}>Token Burn (Est)</div>
                    <div style={{ fontSize: '32px', fontWeight: 600 }}>{(overview?.total_token_usage || 0).toLocaleString()}</div>
                </div>
            </div>

            <div style={styles.card}>
                <h3 style={{ marginBottom: '24px', fontSize: '16px' }}>Activity Snapshot</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '200px', paddingBottom: '20px' }}>
                    {overview?.daily_usage?.map(day => (
                        <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '100%',
                                background: 'linear-gradient(180deg, #6366f1 0%, rgba(99, 102, 241, 0.2) 100%)',
                                borderRadius: '6px 6px 0 0',
                                height: `${Math.min(day.messages * 2, 180)}px`,
                                transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}></div>
                            <span style={{ fontSize: '11px', color: '#a1a1aa' }}>{day.date}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )

    const renderUsers = () => (
        <div style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                <input
                    type="text"
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    style={{ background: '#0a0a0b', border: '1px solid #27272a', padding: '10px 16px', borderRadius: '8px', color: '#fff', width: '300px' }}
                />
                <select
                    value={userStatus}
                    onChange={(e) => setUserStatus(e.target.value)}
                    style={{ background: '#0a0a0b', border: '1px solid #27272a', padding: '10px 16px', borderRadius: '8px', color: '#fff' }}
                >
                    <option value="all">All Users</option>
                    <option value="active">Active Only</option>
                    <option value="suspended">Suspended Only</option>
                    <option value="new">New (7d)</option>
                </select>
                <button
                    onClick={() => window.open(`${BASE_URL}/admin/export/users?token=${getAccessToken()}`)}
                    style={styles.secondaryButton}>Export CSV</button>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #27272a', color: '#a1a1aa', fontSize: '13px' }}>
                        <th style={{ padding: '16px' }}>User</th>
                        <th style={{ padding: '16px' }}>Status</th>
                        <th style={{ padding: '16px' }}>Messages</th>
                        <th style={{ padding: '16px' }}>Last Login</th>
                        <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #27272a', fontSize: '14px' }}>
                            <td style={{ padding: '16px' }}>
                                <div style={{ fontWeight: 500 }}>{u.username}</div>
                                <div style={{ fontSize: '12px', color: '#a1a1aa' }}>{u.email}</div>
                            </td>
                            <td style={{ padding: '16px' }}>
                                <span style={styles.statusBadge(!u.is_suspended)}>
                                    {u.is_suspended ? 'Suspended' : 'Active'}
                                </span>
                            </td>
                            <td style={{ padding: '16px' }}>{u.total_messages}</td>
                            <td style={{ padding: '16px', color: '#a1a1aa' }}>
                                {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                            </td>
                            <td style={{ padding: '16px', textAlign: 'right' }}>
                                {u.role !== 'admin' && (
                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handleToggleSuspension(u.id)}
                                            style={{ ...styles.secondaryButton, padding: '4px 12px', border: u.is_suspended ? '1px solid #22c55e' : '1px solid #ef4444' }}>
                                            {u.is_suspended ? 'Activate' : 'Suspend'}
                                        </button>
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )

    const renderAnalytics = () => (
        <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                <div style={styles.card}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Health Metrics</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <div style={{ color: '#a1a1aa', fontSize: '12px' }}>Avg Latency</div>
                            <div style={{ fontSize: '24px', fontWeight: 600 }}>{health?.avg_response_time_ms.toFixed(0)} ms</div>
                        </div>
                        <div>
                            <div style={{ color: '#a1a1aa', fontSize: '12px' }}>Error Rate</div>
                            <div style={{ fontSize: '24px', fontWeight: 600, color: '#f87171' }}>{health?.api_error_rate}%</div>
                        </div>
                    </div>
                </div>
                <div style={styles.card}>
                    <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Token Breakdown</h3>
                    {tokenStats?.by_model.map(m => (
                        <div key={m.model} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                            <span style={{ color: '#a1a1aa' }}>{m.model}</span>
                            <span>{m.tokens.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div style={styles.card}>
                <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Top 5 Heavy Users</h3>
                {tokenStats?.top_users.map((u, i) => (
                    <div key={u.username} style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                        <span style={{ color: '#6366f1', fontWeight: 600 }}>#{i + 1}</span>
                        <span style={{ flex: 1 }}>{u.username}</span>
                        <span style={{ color: '#a1a1aa' }}>{u.tokens.toLocaleString()} tokens</span>
                    </div>
                ))}
            </div>
        </div>
    )

    const renderSettings = () => (
        <div style={{ maxWidth: '600px' }}>
            <div style={styles.card}>
                <h3 style={{ marginBottom: '24px', fontSize: '16px' }}>General Controls</h3>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px' }}>Default Model</label>
                    <select
                        value={settings?.default_model}
                        onChange={(e) => handleUpdateSettings({ default_model: e.target.value })}
                        style={{ background: '#0a0a0b', border: '1px solid #27272a', padding: '10px', borderRadius: '8px', color: '#fff', width: '100%' }}
                    >
                        <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px' }}>
                    <div>
                        <div style={{ fontWeight: 600, color: '#f87171' }}>Maintenance Mode</div>
                        <div style={{ fontSize: '12px', color: '#a1a1aa' }}>Block all user access while performing updates</div>
                    </div>
                    <button
                        onClick={() => handleUpdateSettings({ maintenance_mode: !settings?.maintenance_mode })}
                        style={{ ...styles.button, background: settings?.maintenance_mode ? '#22c55e' : '#ef4444' }}>
                        {settings?.maintenance_mode ? 'Disable' : 'Enable'}
                    </button>
                </div>
            </div>

            <div style={styles.card}>
                <h3 style={{ marginBottom: '24px', fontSize: '16px' }}>System Limits</h3>
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <label style={{ fontSize: '14px' }}>Daily Token Limit / User</label>
                        <span style={{ color: '#6366f1' }}>{settings?.daily_token_limit_per_user.toLocaleString()}</span>
                    </div>
                    <input
                        type="range" min="1000" max="1000000" step="1000"
                        value={settings?.daily_token_limit_per_user}
                        onChange={(e) => handleUpdateSettings({ daily_token_limit_per_user: parseInt(e.target.value) })}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>
        </div>
    )

    const renderLogs = () => (
        <div style={styles.card}>
            <h3 style={{ marginBottom: '24px', fontSize: '16px' }}>Security Audit Trail</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {logs.map(log => (
                    <div key={log.id} style={{ padding: '12px 16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid #27272a', borderRadius: '8px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: '#6366f1' }}>{log.action}</span>
                            <span style={{ color: '#a1a1aa', fontSize: '11px' }}>{new Date(log.timestamp).toLocaleString()}</span>
                        </div>
                        <div style={{ color: '#d1d1d6' }}>{log.description}</div>
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div style={styles.container}>
            {/* SIDEBAR */}
            <div style={styles.sidebar}>
                <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '40px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', background: '#6366f1', borderRadius: '8px' }}></div>
                    Admin Panel
                </div>

                <div style={{ flex: 1 }}>
                    <div onClick={() => setActiveTab('overview')} style={styles.sidebarItem(activeTab === 'overview')}>Dashboard</div>
                    <div onClick={() => setActiveTab('users')} style={styles.sidebarItem(activeTab === 'users')}>User Management</div>
                    <div onClick={() => setActiveTab('analytics')} style={styles.sidebarItem(activeTab === 'analytics')}>Platform Analytics</div>
                    <div onClick={() => setActiveTab('settings')} style={styles.sidebarItem(activeTab === 'settings')}>System Settings</div>
                    <div onClick={() => setActiveTab('logs')} style={styles.sidebarItem(activeTab === 'logs')}>Audit Logs</div>
                </div>

                <div style={{ borderTop: '1px solid #27272a', paddingTop: '24px' }}>
                    <div onClick={onLogout} style={{ ...styles.sidebarItem(false), color: '#ef4444' }}>Sign Out</div>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div style={styles.main}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 600, textTransform: 'capitalize' }}>{activeTab}</h1>
                        <p style={{ fontSize: '14px', color: '#a1a1aa' }}>Manage and monitor your platform's operational health</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={fetchAllData} style={styles.secondaryButton}>Refresh Data</button>
                    </div>
                </header>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                        <div className="spinner">Loading...</div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'overview' && renderOverview()}
                        {activeTab === 'users' && renderUsers()}
                        {activeTab === 'analytics' && renderAnalytics()}
                        {activeTab === 'settings' && renderSettings()}
                        {activeTab === 'logs' && renderLogs()}
                    </>
                )}
            </div>
        </div>
    )
}
