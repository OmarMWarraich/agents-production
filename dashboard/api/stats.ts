const setCorsHeaders = (res: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

const json = (res: any, status: number, payload: unknown) => {
  setCorsHeaders(res)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const fallbackStats = {
  experiments: [],
}

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res)
    res.statusCode = 204
    res.end()
    return
  }

  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' })
  }

  return json(res, 200, fallbackStats)
}
