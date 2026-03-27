const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || ''

const normalizeApiBaseUrl = (value: string) => {
  const cleaned = value.trim().replace(/^['"]|['"]$/g, '')

  if (!cleaned) {
    return ''
  }

  // Accept bare hostnames like "my-app.vercel.app" by inferring HTTPS.
  if (!/^https?:\/\//i.test(cleaned)) {
    return `https://${cleaned}`
  }

  return cleaned
}

const shouldPreferSameOrigin = (baseUrl: string) => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const configured = new URL(baseUrl)
    const current = window.location
    const isCrossOrigin = configured.origin !== current.origin
    const bothVercelHosts =
      configured.hostname.endsWith('.vercel.app') &&
      current.hostname.endsWith('.vercel.app')

    return isCrossOrigin && bothVercelHosts
  } catch {
    return false
  }
}

export const resolveApiUrl = (path: string) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!rawApiBaseUrl) {
    return normalizedPath
  }

  const normalizedBaseCandidate = normalizeApiBaseUrl(rawApiBaseUrl)

  if (!normalizedBaseCandidate) {
    return normalizedPath
  }

  const normalizedBase = normalizedBaseCandidate.endsWith('/')
    ? normalizedBaseCandidate
    : `${normalizedBaseCandidate}/`

  if (shouldPreferSameOrigin(normalizedBase)) {
    return normalizedPath
  }

  try {
    return new URL(normalizedPath.replace(/^\//, ''), normalizedBase).toString()
  } catch {
    // If URL parsing fails in production, gracefully fall back to same-origin API routes.
    return normalizedPath
  }
}

export const readErrorMessage = async (
  response: Response,
  fallback: string
) => {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as { error?: string; message?: string }
    return payload.error || payload.message || fallback
  }

  const text = await response.text()
  return text.slice(0, 200) || fallback
}