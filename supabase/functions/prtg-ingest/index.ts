// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SECRET_KEY') ?? ''
const adminClient = createClient(supabaseUrl, serviceRoleKey)
const prtgSensorEndpoint =
  '/api/table.json?content=sensors&output=json&columns=objid,probe,group,device,sensor,status,message,lastvalue,priority,lastup,lastdown'
const prtgLimit = 100

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function ensureAuthenticated(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    throw new Error('Missing JWT')
  }

  const { data, error } = await adminClient.auth.getUser(token)
  if (error || !data.user) {
    throw new Error('Invalid JWT')
  }

  return data.user
}

async function ensureAdmin(userId: string) {
  const { data: profile, error } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle<{ role: string }>()

  if (error) {
    throw new Error(error.message)
  }

  if (profile?.role !== 'admin') {
    throw new Error('Permission denied')
  }
}

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, '')
}

function mapSeverity(status: string) {
  const normalized = status.toLowerCase()
  if (normalized.includes('down') || normalized.includes('critical')) return 'critical'
  if (normalized.includes('warning') || normalized.includes('unusual')) return 'warning'
  return 'info'
}

function toPrtgUrl(baseUrl: string, apiToken?: string, username?: string, passhash?: string) {
  const origin = normalizeBaseUrl(baseUrl)
  const endpoint = prtgSensorEndpoint.startsWith('/')
    ? prtgSensorEndpoint
    : `/${prtgSensorEndpoint}`
  const url = new URL(`${origin}${endpoint}`)

  if (apiToken) {
    url.searchParams.set('apitoken', apiToken)
  } else if (username && passhash) {
    url.searchParams.set('username', username)
    url.searchParams.set('passhash', passhash)
  }

  return url.toString()
}

async function fetchPrtgData(server: {
  name: string
  base_url?: string
  api_token?: string
  username?: string
  passhash?: string
}) {
  const baseUrl = server.base_url
  const apiToken = server.api_token

  if (!baseUrl) {
    throw new Error(`Missing base URL for server ${server.name}`)
  }

  const requestUrl = toPrtgUrl(baseUrl, apiToken, server.username, server.passhash)

  const response = await fetch(requestUrl)
  if (!response.ok) {
    throw new Error(`PRTG request failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await ensureAuthenticated(req)
    await ensureAdmin(user.id)

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    let serverId: string | undefined
    try {
      const body = await req.json()
      serverId = body?.serverId
    } catch {
      serverId = undefined
    }

    const query = adminClient
      .from('prtg_servers')
      .select('*')

    if (serverId) {
      query.eq('id', serverId)
    } else {
      query.eq('is_active', true)
    }

    const { data: servers, error: serverError } = await query

    if (serverError) {
      return jsonResponse({ error: serverError.message }, 400)
    }

    if (!servers || servers.length === 0) {
      return jsonResponse({ message: 'No active PRTG server configured' })
    }

    let insertedLogs = 0
    let insertedAlerts = 0

    for (const server of servers) {
      try {
        const payload = await fetchPrtgData(server)
        const sensors = Array.isArray(payload.sensors)
          ? payload.sensors.slice(0, prtgLimit)
          : []

        for (const sensor of sensors) {
          const status = String(sensor.status ?? 'unknown')
          const severity = mapSeverity(status)
          const sensorLabel = String(sensor.sensor ?? sensor.name ?? sensor.objid ?? 'unknown sensor')
          const deviceLabel = String(sensor.device ?? sensor.probe ?? 'unknown device')
          const message = String(sensor.message ?? sensor.lastvalue ?? status)

          const logPayload = {
            server: server.name,
            device: deviceLabel,
            sensor: sensorLabel,
            status,
            message,
            raw: sensor,
          }

          const { error: logError } = await adminClient.from('audit_logs').insert({
            source: 'prtg',
            severity,
            message: `[${deviceLabel}] ${sensorLabel}: ${message}`,
            payload: logPayload,
          })

          if (!logError) {
            insertedLogs += 1
          }

          if (severity !== 'info') {
            const { error: alertError } = await adminClient.from('alerts').insert({
              title: `PRTG cảnh báo: ${deviceLabel}`,
              severity,
              status: 'new',
              score_impact: severity === 'critical' ? 20 : 8,
              description: `${sensorLabel} - ${message}`,
            })

            if (!alertError) {
              insertedAlerts += 1
            }
          }
        }
      } catch (ingestError) {
        const message = ingestError instanceof Error ? ingestError.message : 'Unknown ingest error'
        await adminClient.from('audit_logs').insert({
          source: 'prtg',
          severity: 'critical',
          message: `Ingest thất bại cho server ${server.name}: ${message}`,
          payload: { server },
        })
      }
    }

    return jsonResponse({
      ok: true,
      insertedLogs,
      insertedAlerts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: message }, 401)
  }
})
