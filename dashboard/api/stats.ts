const json = (res: any, status: number, payload: unknown) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

const fallbackStats = {
  experiments: [],
}

export default async function handler(_req: any, res: any) {
  return json(res, 200, fallbackStats)
}
