// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SECRET_KEY') ?? ''

const adminClient = createClient(supabaseUrl, serviceRoleKey)

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    throw new Error('Missing JWT')
  }

  const { data: authData, error: authError } = await adminClient.auth.getUser(token)
  if (authError || !authData.user) {
    throw new Error('Invalid JWT')
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle<{ role: string }>()

  if (profileError) {
    throw new Error(profileError.message)
  }

  if (profile?.role !== 'admin') {
    throw new Error('Permission denied')
  }

  return authData.user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    await requireAdmin(req)

    if (req.method === 'GET') {
      const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers()
      if (usersError) return jsonResponse({ error: usersError.message }, 400)

      const users = usersData.users.map((item) => ({
        id: item.id,
        email: item.email,
        username: (item.user_metadata?.username as string) ?? '',
        role: (item.user_metadata?.role as string) ?? 'user',
        created_at: item.created_at,
      }))

      return jsonResponse(users)
    }

    if (req.method === 'POST') {
      const payload = await req.json()
      const { email, password, username, role } = payload

      if (!email || !password || !username || !role) {
        return jsonResponse({ error: 'Missing fields' }, 400)
      }

      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username, role },
      })

      if (error) return jsonResponse({ error: error.message }, 400)

      await adminClient
        .from('profiles')
        .upsert({ id: data.user.id, username, role })

      return jsonResponse({ ok: true })
    }

    if (req.method === 'PATCH') {
      const payload = await req.json()
      const { userId, email, password, username, role } = payload

      if (!userId) {
        return jsonResponse({ error: 'Missing userId' }, 400)
      }

      const attributes: {
        email?: string
        password?: string
        user_metadata?: Record<string, unknown>
      } = {}

      if (email) attributes.email = email
      if (password) attributes.password = password
      if (username || role) {
        attributes.user_metadata = {}
        if (username) attributes.user_metadata.username = username
        if (role) attributes.user_metadata.role = role
      }

      const { error } = await adminClient.auth.admin.updateUserById(userId, attributes)
      if (error) return jsonResponse({ error: error.message }, 400)

      if (username || role) {
        await adminClient.from('profiles').upsert({
          id: userId,
          ...(username ? { username } : {}),
          ...(role ? { role } : {}),
        })
      }

      return jsonResponse({ ok: true })
    }

    if (req.method === 'DELETE') {
      const payload = await req.json()
      const userId = payload.userId as string

      if (!userId) {
        return jsonResponse({ error: 'Missing userId' }, 400)
      }

      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) return jsonResponse({ error: error.message }, 400)

      return jsonResponse({ ok: true })
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse({ error: message }, 403)
  }
})
