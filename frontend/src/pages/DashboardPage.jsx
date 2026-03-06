import { useState, useEffect, useRef } from 'react'
import { fetchAnalyticsSummary, fetchAnalyticsDaily, fetchAnalyticsAgents } from '../api/client'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell
} from 'recharts'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export default function DashboardPage() {
    const [summary, setSummary] = useState(null)
    const [dailyData, setDailyData] = useState([])
    const [agentData, setAgentData] = useState([])
    const [daysFilter, setDaysFilter] = useState(30)
    const [loading, setLoading] = useState(true)
    const dashboardRef = useRef(null)

    useEffect(() => {
        let isMounted = true
        setLoading(true)

        Promise.all([
            fetchAnalyticsSummary(),
            fetchAnalyticsDaily(daysFilter),
            fetchAnalyticsAgents()
        ]).then(([sumData, dData, aData]) => {
            if (isMounted) {
                setSummary(sumData)

                // Format daily dates
                const formattedDaily = dData.map(d => {
                    const dateObj = new Date(d.date)
                    return {
                        ...d,
                        formattedDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    }
                })
                setDailyData(formattedDaily)
                setAgentData(aData)
                setLoading(false)
            }
        }).catch(err => {
            console.error("Failed to load analytics", err)
            if (isMounted) setLoading(false)
        })

        return () => { isMounted = false }
    }, [daysFilter])

    const formatNumber = (num) => {
        if (num === null || num === undefined) return '0'
        return new Intl.NumberFormat('en-US').format(num)
    }

    const formatCurrency = (num) => {
        if (num === null || num === undefined) return '$0.00'
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
    }

    const exportToPDF = async () => {
        const element = dashboardRef.current
        if (!element) return

        try {
            const canvas = await html2canvas(element, { backgroundColor: '#0A0A0A', scale: 2 })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save(`analytics_report_${daysFilter}days.pdf`)
        } catch (err) {
            console.error("Failed to export PDF", err)
        }
    }

    if (loading && !summary) {
        return (
            <div className="dashboard-container loading">
                <div className="dashboard-spinner"></div>
            </div>
        )
    }

    return (
        <div className="dashboard-container scrollable" ref={dashboardRef}>
            <div className="dashboard-header-bar">
                <div>
                    <h1 className="dashboard-title">Analytics Dashboard</h1>
                    <p className="dashboard-subtitle">Monitor chatbot usage, token consumption, and performance metrics.</p>
                </div>
                <div className="dashboard-actions">
                    <select
                        value={daysFilter}
                        onChange={(e) => setDaysFilter(Number(e.target.value))}
                        className="dashboard-select"
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={30}>Last 30 Days</option>
                        <option value={90}>Last 90 Days</option>
                    </select>
                    <button className="dashboard-btn-export" onClick={exportToPDF}>
                        <span>📄</span> Export to PDF
                    </button>
                </div>
            </div>

            <div className="dashboard-summary-grid">
                <div className="dashboard-card">
                    <div className="card-header">
                        <span className="card-title">Total Conversations</span>
                        <span className="card-icon">💬</span>
                    </div>
                    <div className="card-value">{formatNumber(summary?.total_conversations)}</div>
                    <div className="card-trend text-muted">Active chats</div>
                </div>

                <div className="dashboard-card">
                    <div className="card-header">
                        <span className="card-title">Total Messages</span>
                        <span className="card-icon">✉️</span>
                    </div>
                    <div className="card-value">{formatNumber(summary?.total_messages)}</div>
                    <div className="card-trend text-muted">User & Model combined</div>
                </div>

                <div className="dashboard-card">
                    <div className="card-header">
                        <span className="card-title">Token Usage</span>
                        <span className="card-icon">🪙</span>
                    </div>
                    <div className="card-value gradient-text">{formatNumber(summary?.total_tokens)}</div>
                    <div className="card-trend text-muted">Prompt: {formatNumber(summary?.prompt_tokens)} • Comp: {formatNumber(summary?.completion_tokens)}</div>
                </div>

                <div className="dashboard-card">
                    <div className="card-header">
                        <span className="card-title">Estimated Cost</span>
                        <span className="card-icon">💵</span>
                    </div>
                    <div className="card-value text-green">{formatCurrency(summary?.estimated_cost)}</div>
                    <div className="card-trend text-muted">API running cost</div>
                </div>

                <div className="dashboard-card">
                    <div className="card-header">
                        <span className="card-title">Peak Usage Hour</span>
                        <span className="card-icon">⏰</span>
                    </div>
                    <div className="card-value">{summary?.peak_usage_hour}</div>
                    <div className="card-trend text-muted">Highest activity time</div>
                </div>

                <div className="dashboard-card">
                    <div className="card-header">
                        <span className="card-title">RAG Usage</span>
                        <span className="card-icon">📚</span>
                    </div>
                    <div className="card-value">{summary?.total_rag_usage}%</div>
                    <div className="card-trend text-muted">Retrieval rates</div>
                </div>
            </div>

            <div className="dashboard-charts-grid">
                {/* Main Area Chart */}
                <div className="dashboard-chart-card wide">
                    <div className="chart-header">
                        <h3 className="chart-title">Activity Over Time</h3>
                    </div>
                    <div className="chart-container" style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7c5cfc" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#7c5cfc" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                                <XAxis
                                    dataKey="formattedDate"
                                    stroke="var(--text-muted)"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    stroke="var(--text-muted)"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)', borderRadius: '12px', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)' }}
                                    itemStyle={{ color: '#7c5cfc', fontWeight: 600 }}
                                    labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
                                    formatter={(value, name) => [formatNumber(value), name === 'tokens_used' ? 'Tokens' : 'Messages']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="tokens_used"
                                    name="tokens_used"
                                    stroke="#7c5cfc"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorTokens)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="messages_count"
                                    name="messages_count"
                                    stroke="#00c9a7"
                                    strokeWidth={2}
                                    fill="transparent"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Secondary Bar Chart */}
                <div className="dashboard-chart-card">
                    <div className="chart-header">
                        <h3 className="chart-title">Top Agents</h3>
                    </div>
                    <div className="chart-container" style={{ height: 320 }}>
                        {agentData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={agentData.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 50, left: 30, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="agent_name"
                                        type="category"
                                        stroke="var(--text-primary)"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 13, fill: 'var(--text-secondary)' }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'var(--bg-hover)' }}
                                        contentStyle={{ backgroundColor: 'var(--bg-panel)', borderColor: 'var(--border)', borderRadius: '12px' }}
                                        formatter={(val, name, props) => {
                                            return [`${formatNumber(val)} msgs (${props.payload.usage_percentage}%)`, 'Usage']
                                        }}
                                    />
                                    <Bar dataKey="usage_count" radius={[0, 4, 4, 0]} barSize={24}>
                                        {agentData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={index === 0 ? '#7c5cfc' : '#00c9a7'} opacity={index === 0 ? 1 : 0.7} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                                No agent data available
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="dashboard-bottom-stats">
                <div className="stat-pill">
                    <span className="stat-pill-label">Most Active Agent:</span>
                    <span className="stat-pill-value">{summary?.most_used_agent}</span>
                </div>
                <div className="stat-pill">
                    <span className="stat-pill-label">Average Response Time:</span>
                    <span className="stat-pill-value">{formatNumber(summary?.avg_response_time)} ms</span>
                </div>
            </div>

            {/* Some bottom spacing */}
            <div style={{ height: '40px' }}></div>
        </div>
    )
}
