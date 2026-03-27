const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || ''

export const resolveApiUrl = (path: string) => {
  if (!rawApiBaseUrl) {
    return path
  }

  if (!/^https?:\/\//i.test(rawApiBaseUrl)) {
    throw new Error(
      'Invalid VITE_API_BASE_URL. Use a full URL like https://your-backend.example.com'
    )
  }

  const normalizedBase = rawApiBaseUrl.endsWith('/')
    ? rawApiBaseUrl
    : `${rawApiBaseUrl}/`

  return new URL(path.replace(/^\//, ''), normalizedBase).toString()
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