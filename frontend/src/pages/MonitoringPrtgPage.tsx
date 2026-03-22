import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { deletePrtgServer, getPrtgServers, syncPrtgNow, upsertPrtgServer } from '../services/prtgService'
import type { PrtgServer } from '../types'

const emptyForm = {
  id: '',
  name: '',
  base_url: '',
  api_token: '',
  username: '',
  passhash: '',
  is_active: true,
}

export function MonitoringPrtgPage() {
  const [servers, setServers] = useState<PrtgServer[]>([])
  const [form, setForm] = useState(emptyForm)
  const [message, setMessage] = useState('')

  const loadServers = async () => {
    const data = await getPrtgServers()
    setServers(data)
  }

  useEffect(() => {
    void loadServers()
  }, [])

  const saveServer = async (event: FormEvent) => {
    event.preventDefault()
    await upsertPrtgServer(form)
    setMessage('Đã lưu cấu hình PRTG server')
    setForm(emptyForm)
    await loadServers()
  }

  const editServer = (server: PrtgServer) => {
    setForm({
      id: server.id,
      name: server.name,
      base_url: server.base_url,
      api_token: server.api_token ?? '',
      username: server.username ?? '',
      passhash: server.passhash ?? '',
      is_active: server.is_active,
    })
  }

  const removeServer = async (id: string) => {
    await deletePrtgServer(id)
    await loadServers()
  }

  const runSync = async () => {
    await syncPrtgNow()
    setMessage('Đã lấy dữ liệu từ tất cả PRTG server active')
  }

  const runSyncOne = async (serverId: string) => {
    await syncPrtgNow(serverId)
    setMessage('Đã lấy dữ liệu từ PRTG server được chọn')
  }

  return (
    <div>
      <PageHeader
        title="Cấu hình giám sát / PRTG"
        subtitle="Thêm sửa xóa thông tin PRTG server và đồng bộ dữ liệu"
        action={<button onClick={runSync}>Đồng bộ ngay</button>}
      />

      <form className="panel form-grid" onSubmit={saveServer}>
        <label>
          Tên server
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
        </label>

        <label>
          Base URL
          <input
            value={form.base_url}
            onChange={(event) => setForm((prev) => ({ ...prev, base_url: event.target.value }))}
            required
          />
        </label>

        <label>
          API Token
          <input
            value={form.api_token}
            onChange={(event) => setForm((prev) => ({ ...prev, api_token: event.target.value }))}
            placeholder="Neu dung API token"
          />
        </label>

        <label>
          Username (optional)
          <input
            value={form.username}
            onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
            placeholder="Neu dung username/passhash"
          />
        </label>

        <label>
          Passhash (optional)
          <input
            value={form.passhash}
            onChange={(event) => setForm((prev) => ({ ...prev, passhash: event.target.value }))}
            placeholder="PRTG passhash"
          />
        </label>

        <label className="inline-check">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
          />
          Kích hoạt
        </label>

        <button type="submit">{form.id ? 'Cập nhật' : 'Tạo mới'}</button>
      </form>

      {message ? <p>{message}</p> : null}

      <section className="panel">
        <h2>Danh sách PRTG server</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Tên</th>
              <th>URL</th>
              <th>Auth</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {servers.map((server) => (
              <tr key={server.id}>
                <td>{server.name}</td>
                <td>{server.base_url}</td>
                <td>
                  {server.api_token
                    ? 'API Token'
                    : server.username && server.passhash
                      ? 'Username + Passhash'
                      : 'Chua cau hinh'}
                </td>
                <td>{server.is_active ? 'Active' : 'Inactive'}</td>
                <td className="actions">
                  <button onClick={() => runSyncOne(server.id)}>Lay du lieu</button>
                  <button onClick={() => editServer(server)}>Sửa</button>
                  <button onClick={() => removeServer(server.id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
