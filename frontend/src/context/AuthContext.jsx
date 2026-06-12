import { createContext, useState, useEffect, useContext } from 'react'
import { isAuthenticated, getUser, saveTokens, saveUser, clearAuth, fetchMe, login as apiLogin } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [authed, setAuthed] = useState(isAuthenticated())
    const [user, setUser] = useState(() => getUser())
    const [loading, setLoading] = useState(false)

    const login = async (email, password) => {
        setLoading(true)
        try {
            const tokens = await apiLogin({ email, password })
            saveTokens(tokens.access_token, tokens.refresh_token)
            const profile = await fetchMe()
            saveUser(profile)
            setUser(profile)
            setAuthed(true)
            return profile
        } catch (error) {
            clearAuth()
            setAuthed(false)
            setUser(null)
            throw error;
        } finally {
            setLoading(false)
        }
    }

    const logout = () => {
        clearAuth()
        setAuthed(false)
        setUser(null)
    }

    const updateUser = (updatedUser) => {
        saveUser(updatedUser)
        setUser(updatedUser)
    }

    return (
        <AuthContext.Provider value={{ authed, user, loading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuthContext = () => useContext(AuthContext)
