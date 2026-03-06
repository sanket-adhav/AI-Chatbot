import { useState } from 'react'
import { register, login, saveTokens, saveUser, fetchMe } from '../api/client'

const FEATURES = [
    { icon: '⚡', label: 'Real-time streaming responses' },
    { icon: '🧠', label: 'Multi-agent AI architecture' },
    { icon: '🔒', label: 'Secure JWT authentication' },
]

export default function AuthPage({ onAuth }) {
    const [mode, setMode] = useState('login')
    const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
    const [showPass, setShowPass] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

    const switchMode = (m) => { setMode(m); setError(''); setForm({ username: '', email: '', password: '', confirm: '' }) }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        if (mode === 'register' && form.password !== form.confirm) {
            setError('Passwords do not match')
            return
        }
        setLoading(true)
        try {
            if (mode === 'register') {
                await register({ username: form.username, email: form.email, password: form.password })
            }
            const tokens = await login({ email: form.email, password: form.password })
            saveTokens(tokens.access_token, tokens.refresh_token)

            const user = await fetchMe()
            saveUser(user)

            onAuth()
        } catch (err) {
            const detail = err.response?.data?.detail
            setError(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="auth-split-root">
            {/* Ambient background dots */}
            <div className="auth-split-dots" />

            <div className="auth-split-card">
                {/* ── LEFT — Form panel ─────────────────────────────────── */}
                <div className="auth-split-left">
                    {/* Logo */}
                    <div className="auth-split-logo">
                        <div className="auth-split-logo-icon">✦</div>
                        <span className="auth-split-logo-text">AI CHATBOT</span>
                    </div>

                    <h1 className="auth-split-title">
                        {mode === 'login' ? 'Welcome back' : 'Create an account'}
                    </h1>
                    <p className="auth-split-sub">
                        {mode === 'login'
                            ? 'Sign in to continue to your AI workspace'
                            : 'Sign up and start chatting with AI agents'}
                    </p>

                    {/* Mode tabs */}
                    <div className="auth-split-tabs">
                        <button
                            className={`auth-split-tab ${mode === 'login' ? 'active' : ''}`}
                            onClick={() => switchMode('login')}
                            type="button"
                        >Log in</button>
                        <button
                            className={`auth-split-tab ${mode === 'register' ? 'active' : ''}`}
                            onClick={() => switchMode('register')}
                            type="button"
                        >Sign up</button>
                    </div>

                    <form className="auth-split-form" onSubmit={handleSubmit}>
                        {mode === 'register' && (
                            <div className="auth-split-field">
                                <label className="auth-split-label">Username</label>
                                <input
                                    id="auth-username"
                                    type="text"
                                    className="auth-split-input"
                                    placeholder="Display name"
                                    value={form.username}
                                    onChange={set('username')}
                                    required
                                    autoComplete="username"
                                    minLength={3}
                                />
                            </div>
                        )}

                        <div className="auth-split-field">
                            <label className="auth-split-label">Email</label>
                            <input
                                id="auth-email"
                                type="email"
                                className="auth-split-input"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={set('email')}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div className="auth-split-field">
                            <label className="auth-split-label">Password</label>
                            <div className="auth-split-input-wrap">
                                <input
                                    id="auth-password"
                                    type={showPass ? 'text' : 'password'}
                                    className="auth-split-input has-toggle"
                                    placeholder={mode === 'register' ? 'Min 6 characters' : 'Your password'}
                                    value={form.password}
                                    onChange={set('password')}
                                    required
                                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                    minLength={6}
                                />
                                <button type="button" className="auth-split-eye" onClick={() => setShowPass(v => !v)}
                                    tabIndex={-1} aria-label="Toggle password visibility">
                                    {showPass ? '🙈' : '👁'}
                                </button>
                            </div>
                        </div>

                        {mode === 'register' && (
                            <div className="auth-split-field">
                                <label className="auth-split-label">Repeat password</label>
                                <div className="auth-split-input-wrap">
                                    <input
                                        id="auth-confirm"
                                        type={showConfirm ? 'text' : 'password'}
                                        className="auth-split-input has-toggle"
                                        placeholder="Repeat your password"
                                        value={form.confirm}
                                        onChange={set('confirm')}
                                        required
                                        autoComplete="new-password"
                                    />
                                    <button type="button" className="auth-split-eye" onClick={() => setShowConfirm(v => !v)}
                                        tabIndex={-1} aria-label="Toggle confirm password visibility">
                                        {showConfirm ? '🙈' : '👁'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && <div className="auth-split-error">{error}</div>}

                        <button
                            type="submit"
                            className="auth-split-btn"
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="auth-split-spinner" />
                            ) : mode === 'login' ? 'Sign In →' : 'Create Account →'}
                        </button>
                    </form>

                    <p className="auth-split-switch">
                        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            type="button"
                            className="auth-split-switch-btn"
                            onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                        >
                            {mode === 'login' ? 'Sign up' : 'Log in'}
                        </button>
                    </p>
                </div>

                {/* ── RIGHT — Visual panel ───────────────────────────────── */}
                <div className="auth-split-right">
                    {/* Animated orb */}
                    <div className="auth-split-orb-wrap">
                        <div className="auth-split-orb">
                            <div className="auth-split-orb-inner">✦</div>
                        </div>
                        <div className="auth-split-orb-ring r1" />
                        <div className="auth-split-orb-ring r2" />
                        <div className="auth-split-orb-ring r3" />
                    </div>

                    <div className="auth-split-brand">AI.CHATBOT</div>
                    <div className="auth-split-tagline">
                        Your intelligent multi-agent<br />AI platform
                    </div>

                    <div className="auth-split-features">
                        {FEATURES.map(f => (
                            <div key={f.label} className="auth-split-feature-pill">
                                <span className="auth-split-feature-icon">{f.icon}</span>
                                {f.label}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
