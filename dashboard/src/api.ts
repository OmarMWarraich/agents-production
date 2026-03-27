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