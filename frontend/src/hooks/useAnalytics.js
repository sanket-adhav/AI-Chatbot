import { useState, useEffect } from 'react'
import { fetchAnalyticsSummary, fetchAnalyticsDaily, fetchAnalyticsAgents } from '../api/client'

export function useAnalytics(initialDaysFilter = 30) {
    const [summary, setSummary] = useState(null)
    const [dailyData, setDailyData] = useState([])
    const [agentData, setAgentData] = useState([])
    const [daysFilter, setDaysFilter] = useState(initialDaysFilter)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const fetchAll = async (filter) => {
        setLoading(true)
        setError(null)
        try {
            const [sumData, dData, aData] = await Promise.all([
                fetchAnalyticsSummary(),
                fetchAnalyticsDaily(filter),
                fetchAnalyticsAgents()
            ])

            // Format daily dates
            const formattedDaily = dData.map(d => {
                const dateObj = new Date(d.date)
                return {
                    ...d,
                    formattedDate: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }
            })

            setSummary(sumData)
            setDailyData(formattedDaily)
            setAgentData(aData)
        } catch (err) {
            console.error("Failed to load analytics", err)
            setError(err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAll(daysFilter)
    }, [daysFilter])

    const refetch = () => fetchAll(daysFilter)

    return {
        summary,
        dailyData,
        agentData,
        daysFilter,
        setDaysFilter,
        loading,
        error,
        refetch
    }
}
