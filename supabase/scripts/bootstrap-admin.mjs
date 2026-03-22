const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SECRET_KEY

const email = process.env.BOOTSTRAP_ADMIN_EMAIL
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
const username = process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin'

if (!url || !serviceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
}

if (!email || !password) {
  throw new Error('Missing BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_PASSWORD in environment')
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
}

async function request(path, options = {}) {
  const response = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  })

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.msg
      ? payload.msg
      : JSON.stringify(payload)
    throw new Error(`Request failed ${path}: ${response.status} ${message}`)
  }

  return payload
}

let userId = null

try {
  const created = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        role: 'admin',
      },
    }),
  })

  userId = created.id
  console.log('Admin user created:', email)
} catch (error) {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (!message.includes('already') && !message.includes('422')) {
    throw error
  }

  console.log('Admin user already exists, syncing role...')
  const listed = await request('/auth/v1/admin/users?page=1&per_page=100')
  const existing = listed?.users?.find((u) => u.email === email)
  if (!existing) {
    throw new Error('Cannot find existing admin user by email')
  }
  userId = existing.id
}

await request('/rest/v1/profiles?on_conflict=id', {
  method: 'POST',
  headers: {
    Prefer: 'resolution=merge-duplicates,return=minimal',
  },
  body: JSON.stringify([
    {
      id: userId,
      username,
      role: 'admin',
    },
  ]),
})

console.log('Admin profile synced:', userId)
