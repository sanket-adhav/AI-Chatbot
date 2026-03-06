import axios from 'axios'

const BASE_URL = 'http://localhost:8000'

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
})

// ── Auth token helpers ────────────────────────────────────────────────────────

export const getAccessToken = () => localStorage.getItem('access_token')
export const getRefreshToken = () => localStorage.getItem('refresh_token')
export const getUser = () => {
    const u = localStorage.getItem('user')
    return u ? JSON.parse(u) : null
}

export const saveTokens = (access, refresh) => {
    localStorage.setItem('access_token', access)
    localStorage.setItem('refresh_token', refresh)
}

export const saveUser = (user) => localStorage.setItem('user', JSON.stringify(user))

export const clearAuth = () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
}

export const isAuthenticated = () => !!getAccessToken()

// ── Request interceptor: attach Bearer token ──────────────────────────────────

api.interceptors.request.use((config) => {
    const token = getAccessToken()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

// ── Response interceptor: auto-refresh on 401 ────────────────────────────────

let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error)
        else resolve(token)
    })
    failedQueue = []
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true
            const refresh = getRefreshToken()
            if (!refresh) {
                clearAuth()
                window.location.href = '/'
                return Promise.reject(error)
            }
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject })
                }).then(token => {
                    original.headers.Authorization = `Bearer ${token}`
                    return api(original)
                })
            }
            isRefreshing = true
            try {
                const res = await axios.post(`${BASE_URL}/auth/refresh`, null, {
                    headers: { Authorization: `Bearer ${refresh}` }
                })
                const { access_token, refresh_token } = res.data
                saveTokens(access_token, refresh_token)
                processQueue(null, access_token)
                original.headers.Authorization = `Bearer ${access_token}`
                return api(original)
            } catch (e) {
                processQueue(e, null)
                clearAuth()
                window.location.href = '/'
                return Promise.reject(e)
            } finally {
                isRefreshing = false
            }
        }
        return Promise.reject(error)
    }
)

// ── Auth Endpoints ────────────────────────────────────────────────────────────

export const register = (data) => api.post('/auth/register', data).then(r => r.data)
export const login = (data) => api.post('/auth/login', data).then(r => r.data)
export const fetchMe = () => api.get('/auth/me').then(r => r.data)
export const updateProfile = (data) => api.put('/auth/me', data).then(r => r.data)
export const uploadAvatar = (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/auth/avatar', formData, {
        headers: {
            'Content-Type': undefined
        }
    }).then(r => r.data)
}

// ── Agents ────────────────────────────────────────────────────────────────────

export const fetchAgents = () => api.get('/agents').then(r => r.data)
export const fetchAgent = (id) => api.get(`/agents/${id}`).then(r => r.data)
export const createAgent = (data) => api.post('/agents', data).then(r => r.data)
export const deleteAgent = (id) => api.delete(`/agents/${id}`)

// ── Folders ───────────────────────────────────────────────────────────────────

export const fetchFolders = () => api.get('/folders').then(r => r.data)
export const createFolder = (name) => api.post('/folders', { name }).then(r => r.data)
export const deleteFolder = (id) => api.delete(`/folders/${id}`)

// ── Conversations ─────────────────────────────────────────────────────────────

export const fetchConversations = () => api.get('/conversations').then(r => r.data)
export const fetchConversation = (id) => api.get(`/conversations/${id}`).then(r => r.data)
export const createConversation = (data) => api.post('/conversations', data).then(r => r.data)
export const updateConversation = (id, data) => api.patch(`/conversations/${id}`, data).then(r => r.data)
export const deleteConversation = (id) => api.delete(`/conversations/${id}`)
export const togglePin = (id) => api.patch(`/conversations/${id}/pin`).then(r => r.data)
export const moveToFolder = (id, folderId) => api.patch(`/conversations/${id}/move`, { folder_id: folderId }).then(r => r.data)

export const deleteMessage = (convId, msgId) => api.delete(`/conversations/${convId}/messages/${msgId}`)

// ── Messages ──────────────────────────────────────────────────────────────────

export const fetchMessages = (convId) =>
    api.get(`/conversations/${convId}/messages`).then(r => r.data)

export const sendMessage = (convId, content, modelName) =>
    api.post(`/conversations/${convId}/messages`, { content, model_name: modelName }).then(r => r.data)

// ── Search ────────────────────────────────────────────────────────────────────

export const globalSearch = (q, page = 1, pageSize = 20) =>
    api.get('/search', { params: { q, page, page_size: pageSize } }).then(r => r.data)

export const searchInChat = (convId, q, page = 1, pageSize = 20) =>
    api.get(`/conversations/${convId}/search`, { params: { q, page, page_size: pageSize } }).then(r => r.data)

// ── Export ────────────────────────────────────────────────────────────────────

const _triggerDownload = async (url, filename) => {
    const res = await api.get(url, { responseType: 'blob' })
    const href = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    a.click()
    URL.revokeObjectURL(href)
}

export const exportChatJson = (convId) =>
    _triggerDownload(`/conversations/${convId}/export/json`, `chat_${convId}.json`)

export const exportChatPdf = (convId) =>
    _triggerDownload(`/conversations/${convId}/export/pdf`, `chat_${convId}.pdf`)

// ── Image Upload ──────────────────────────────────────────────────────────────

export const sendImageMessage = (convId, text, imageFile, modelName) => {
    const formData = new FormData()
    formData.append('image', imageFile)
    if (text) formData.append('content', text)
    if (modelName) formData.append('model_name', modelName)
    // Do NOT set Content-Type manually — axios auto-adds multipart/form-data + boundary
    return api.post(
        `/conversations/${convId}/messages/image`,
        formData,
        { headers: { 'Content-Type': undefined }, timeout: 60000 },
    ).then(r => r.data)
}

// ── Streaming ─────────────────────────────────────────────────────────────────

/**
 * Stream a chat message using fetch + ReadableStream (SSE).
 * Calls onChunk(text) for each token, onDone({ msg_id, conv_id }) on completion,
 * onError(message) on failure. Returns an AbortController for cancellation.
 */
export const streamChatMessage = (convId, content, useDocuments, modelName, { onChunk, onDone, onError }) => {
    const controller = new AbortController()
    const token = getAccessToken()

        ; (async () => {
            let response
            try {
                response = await fetch(`${BASE_URL}/conversations/${convId}/messages/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ content, use_documents: useDocuments, model_name: modelName }),
                    signal: controller.signal,
                })
            } catch (err) {
                if (err.name !== 'AbortError') onError?.('Network error. Please try again.')
                return
            }

            if (!response.ok) {
                const status = response.status
                if (status === 401) onError?.('Session expired. Please log in again.')
                else if (status === 429) onError?.('Too many requests. Please wait a moment.')
                else onError?.(`Server error (${status}). Please try again.`)
                return
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''

            try {
                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break

                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() // keep incomplete line in buffer

                    for (const line of lines) {
                        if (!line.startsWith('data: ')) continue
                        const jsonStr = line.slice(6).trim()
                        if (!jsonStr) continue

                        let parsed
                        try { parsed = JSON.parse(jsonStr) } catch { continue }

                        if (parsed.error) {
                            onError?.(parsed.error)
                            return
                        }
                        if (parsed.chunk) {
                            onChunk?.(parsed.chunk)
                        }
                        if (parsed.done) {
                            onDone?.({ msg_id: parsed.msg_id, conv_id: parsed.conv_id })
                        }
                    }
                }
            } catch (err) {
                if (err.name !== 'AbortError') onError?.('Stream interrupted. Please try again.')
            } finally {
                reader.releaseLock()
            }
        })()

    return controller
}

// ── Documents Endpoints ───────────────────────────────────────────────────────

export const getDocuments = () => api.get('/documents').then(r => r.data)

export const uploadDocument = (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/documents/upload', formData, {
        headers: {
            'Content-Type': undefined // Let Axios set the correct boundary
        }
    }).then(r => r.data)
}

export const deleteDocument = (id) => api.delete(`/documents/${id}`).then(r => r.data)

// ── Analytics Endpoints ───────────────────────────────────────────────────────
export const fetchAnalyticsSummary = () => api.get('/analytics/summary').then(r => r.data)
export const fetchAnalyticsDaily = (days = 30) => api.get(`/analytics/daily?days=${days}`).then(r => r.data)
export const fetchAnalyticsAgents = () => api.get('/analytics/agents').then(r => r.data)

export default api
