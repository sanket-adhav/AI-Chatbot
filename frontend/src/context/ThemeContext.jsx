import { createContext, useState, useEffect, useContext } from 'react'
import { useAuthContext } from './AuthContext'

const ThemeContext = createContext(null)

export const THEMES = [
    { id: 'dark', name: 'Dark Nebula', color: '#0f172a' },
    { id: 'light', name: 'Cosmic Light', color: '#f8fafc' },
    { id: 'ocean', name: 'Deep Ocean', color: '#075985' },
    { id: 'emerald', name: 'Emerald Aurora', color: '#065f46' }
]

export function ThemeProvider({ children }) {
    const { user, updateUser } = useAuthContext() || {}
    const [theme, setThemeState] = useState(() => {
        if (user && user.theme_preference) return user.theme_preference
        return 'dark'
    })

    useEffect(() => {
        if (user && user.theme_preference) {
            setThemeState(user.theme_preference)
        }
    }, [user])

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

    const setTheme = (newTheme) => {
        setThemeState(newTheme)
        if (user && updateUser) {
            updateUser({ ...user, theme_preference: newTheme })
        }
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
            {children}
        </ThemeContext.Provider>
    )
}

export const useThemeContext = () => useContext(ThemeContext)
