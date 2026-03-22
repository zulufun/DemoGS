import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import { deleteGateOpenLog, listGateOpenLogs, upsertGateOpenLog } from '../services/operationService'
import type { GateOpenLog } from '../types'

const gateFormDefault = {
  id: '',
  contact_first_name: '',
  contact_last_name: '',
  unit: '',
  ip_source: '',
  ip_dest: '',
  port: '',
  usage_time: '',
  basis: '',
  work_content: '',
  opened_by: '',
}

export function GateLogPage() {
  const [logs, setLogs] = useState<GateOpenLog[]>([])
  const [form, setForm] = useState(gateFormDefault)
  const [status, setStatus] = useState('')

  const loadLogs = async () => {
    const data = await listGateOpenLogs()
    setLogs(data)
  }

  useEffect(() => {
    void loadLogs()
  }, [])

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()

    await upsertGateOpenLog({
      id: form.id || undefined,
      contact_first_name: form.contact_first_name,
      contact_last_name: form.contact_last_name,
      unit: form.unit,
      ip_source: form.ip_source,
      ip_dest: form.ip_dest,
      port: form.port,
      usage_time: form.usage_time,
      basis: form.basis,
      work_content: form.work_content,
      opened_by: form.opened_by,
    })

    setStatus(form.id ? 'Đã cập nhật nhật kí mở cổng' : 'Đã thêm nhật kí mở cổng')
    setForm(gateFormDefault)
    await loadLogs()
  }

  const handleEdit = (item: GateOpenLog) => {
    setForm({
      id: item.id,
      contact_first_name: item.contact_first_name,
      contact_last_name: item.contact_last_name,
      unit: item.unit,
      ip_source: item.ip_source,
      ip_dest: item.ip_dest,
      port: item.port,
      usage_time: item.usage_time,
      basis: item.basis,
      work_content: item.work_content,
      opened_by: item.opened_by,
    })
  }

  const handleDelete = async (id: string) => {
    await deleteGateOpenLog(id)
    setStatus('Đã xóa nhật kí mở cổng')
    await loadLogs()
  }

  return (
    <div>
      <PageHeader
        title="Điều hành trực / Quản lý nhật kí mở cổng"
        subtitle="Theo dõi thông tin mở cổng mạng phục vụ vận hành"
      />

      <form className="panel form-grid" onSubmit={handleSave}>
        <label>
          Họ người liên hệ
          <input
            required
            value={form.contact_first_name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, contact_first_name: event.target.value }))
            }
          />
        </label>

        <label>
          Tên người liên hệ
          <input
            required
            value={form.contact_last_name}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, contact_last_name: event.target.value }))
            }
          />
        </label>

        <label>
          Đơn vị
          <input
            required
            value={form.unit}
            onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
          />
        </label>

        <label>
          IP Source
          <input
            required
            value={form.ip_source}
            onChange={(event) => setForm((prev) => ({ ...prev, ip_source: event.target.value }))}
          />
        </label>

        <label>
          IP Dest
          <input
            required
            value={form.ip_dest}
            onChange={(event) => setForm((prev) => ({ ...prev, ip_dest: event.target.value }))}
          />
        </label>

        <label>
          Cổng
          <input
            required
            value={form.port}
            onChange={(event) => setForm((prev) => ({ ...prev, port: event.target.value }))}
          />
        </label>

        <label>
          Thời gian sử dụng
          <input
            required
            value={form.usage_time}
            onChange={(event) => setForm((prev) => ({ ...prev, usage_time: event.target.value }))}
          />
        </label>

        <label>
          Căn cứ
          <input
            required
            value={form.basis}
            onChange={(event) => setForm((prev) => ({ ...prev, basis: event.target.value }))}
          />
        </label>

        <label>
          Nội dung thực hiện
          <input
            required
            value={form.work_content}
            onChange={(event) => setForm((prev) => ({ ...prev, work_content: event.target.value }))}
          />
        </label>

        <label>
          Người mở
          <input
            required
            value={form.opened_by}
            onChange={(event) => setForm((prev) => ({ ...prev, opened_by: event.target.value }))}
          />
        </label>

        <button type="submit">{form.id ? 'Cập nhật nhật kí' : 'Thêm nhật kí'}</button>
      </form>

      {status ? <p>{status}</p> : null}

      <section className="panel">
        <h2>Danh sách nhật kí mở cổng</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Người liên hệ</th>
              <th>Đơn vị</th>
              <th>IP Source</th>
              <th>IP Dest</th>
              <th>Cổng</th>
              <th>Thời gian sử dụng</th>
              <th>Căn cứ</th>
              <th>Nội dung thực hiện</th>
              <th>Người mở</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((item) => (
              <tr key={item.id}>
                <td>{`${item.contact_first_name} ${item.contact_last_name}`}</td>
                <td>{item.unit}</td>
                <td>{item.ip_source}</td>
                <td>{item.ip_dest}</td>
                <td>{item.port}</td>
                <td>{item.usage_time}</td>
                <td>{item.basis}</td>
                <td>{item.work_content}</td>
                <td>{item.opened_by}</td>
                <td className="actions">
                  <button onClick={() => handleEdit(item)}>Sửa</button>
                  <button onClick={() => handleDelete(item.id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
