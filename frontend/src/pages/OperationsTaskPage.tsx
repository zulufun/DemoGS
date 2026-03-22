import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../components/common/PageHeader'
import {
  completeOperationTask,
  deleteOperationTask,
  listOperationTasks,
  upsertOperationTask,
} from '../services/operationService'
import type { OperationTask } from '../types'

const taskFormDefault = {
  id: '',
  task_date: new Date().toISOString().slice(0, 10),
  executor: '',
  lead_person: '',
  supervisor: '',
  unit: '',
  work_content: '',
  start_time: '',
  end_time: '',
  result_content: '',
}

const finishFormDefault = {
  end_time: '',
  result_content: '',
}

export function OperationsTaskPage() {
  const [tasks, setTasks] = useState<OperationTask[]>([])
  const [form, setForm] = useState(taskFormDefault)
  const [status, setStatus] = useState('')
  const [finishTaskId, setFinishTaskId] = useState('')
  const [finishForm, setFinishForm] = useState(finishFormDefault)

  const loadTasks = async () => {
    const data = await listOperationTasks()
    setTasks(data)
  }

  useEffect(() => {
    void loadTasks()
  }, [])

  const runningCount = useMemo(
    () => tasks.filter((item) => !item.end_time).length,
    [tasks],
  )

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()

    await upsertOperationTask({
      id: form.id || undefined,
      task_date: form.task_date,
      executor: form.executor,
      lead_person: form.lead_person,
      supervisor: form.supervisor,
      unit: form.unit,
      work_content: form.work_content,
      start_time: form.start_time,
      end_time: form.end_time || null,
      result_content: form.result_content || null,
    })

    setStatus(form.id ? 'Đã cập nhật' : 'Đã tạo')
    setForm(taskFormDefault)
    await loadTasks()
  }

  const handleEdit = (item: OperationTask) => {
    setForm({
      id: item.id,
      task_date: item.task_date,
      executor: item.executor,
      lead_person: item.lead_person,
      supervisor: item.supervisor,
      unit: item.unit,
      work_content: item.work_content,
      start_time: item.start_time,
      end_time: item.end_time ?? '',
      result_content: item.result_content ?? '',
    })
  }

  const handleDelete = async (id: string) => {
    await deleteOperationTask(id)
    setStatus('Đã xóa nhiệm vụ')
    if (finishTaskId === id) {
      setFinishTaskId('')
      setFinishForm(finishFormDefault)
    }
    await loadTasks()
  }

  const beginFinish = (taskId: string) => {
    setFinishTaskId(taskId)
    setFinishForm(finishFormDefault)
  }

  const submitFinish = async (event: FormEvent) => {
    event.preventDefault()
    if (!finishTaskId) return

    await completeOperationTask(finishTaskId, finishForm.end_time, finishForm.result_content)
    setStatus('Đã kết thúc nhiệm vụ')
    setFinishTaskId('')
    setFinishForm(finishFormDefault)
    await loadTasks()
  }

  return (
    <div>
      <PageHeader
        title="Điều hành trực / Quản lý ra vào"
        subtitle={`Đang có ${runningCount} người vào thực hiện nhiệm vụ chưa xác nhận ra`}
      />

      <form className="panel form-grid" onSubmit={handleSave}>
        <label>
          Ngày tháng năm
          <input
            type="date"
            required
            value={form.task_date}
            onChange={(event) => setForm((prev) => ({ ...prev, task_date: event.target.value }))}
          />
        </label>

        <label>
          Họ tên người vào
          <input
            required
            value={form.executor}
            onChange={(event) => setForm((prev) => ({ ...prev, executor: event.target.value }))}
          />
        </label>

        <label>
          Người dẫn vào thực hiện
          <input
            required
            value={form.lead_person}
            onChange={(event) => setForm((prev) => ({ ...prev, lead_person: event.target.value }))}
          />
        </label>

        <label>
          Người giám sát (T6)
          <input
            required
            value={form.supervisor}
            onChange={(event) => setForm((prev) => ({ ...prev, supervisor: event.target.value }))}
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
          Nội dung thực hiện
          <input
            required
            value={form.work_content}
            onChange={(event) => setForm((prev) => ({ ...prev, work_content: event.target.value }))}
          />
        </label>

        <label>
          Giờ bắt đầu
          <input
            type="time"
            required
            value={form.start_time}
            onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
          />
        </label>

        <label>
          Giờ kết thúc
          <input
            type="time"
            value={form.end_time}
            onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
          />
        </label>

        <label>
          Kết quả thực hiện
          <input
            value={form.result_content}
            onChange={(event) => setForm((prev) => ({ ...prev, result_content: event.target.value }))}
          />
        </label>

        <button type="submit">{form.id ? 'Cập nhật' : 'Tạo'}</button>
      </form>

      {status ? <p>{status}</p> : null}

      {finishTaskId ? (
        <form className="panel form-grid" onSubmit={submitFinish}>
          <h2>Xác nhận ra</h2>
          <label>
            Giờ kết thúc
            <input
              type="time"
              required
              value={finishForm.end_time}
              onChange={(event) => setFinishForm((prev) => ({ ...prev, end_time: event.target.value }))}
            />
          </label>

          <label>
            Kết quả thực hiện
            <input
              required
              value={finishForm.result_content}
              onChange={(event) => setFinishForm((prev) => ({ ...prev, result_content: event.target.value }))}
            />
          </label>

          <div className="actions">
            <button type="submit">Lưu kết quả thực hiện</button>
            <button type="button" onClick={() => setFinishTaskId('')}>
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      <section className="panel">
        <h2>Danh sách nhiệm vụ</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Ngày</th>
              <th>Người thực hiện</th>
              <th>Đơn vị</th>
              <th>Nội dung</th>
              <th>Giờ bắt đầu</th>
              <th>Giờ kết thúc</th>
              <th>Kết quả</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.task_date).toLocaleDateString('vi-VN')}</td>
                <td>
                  <strong>{item.executor}</strong>
                  <p>Dẫn vào: {item.lead_person}</p>
                  <p>Giám sát: {item.supervisor}</p>
                </td>
                <td>{item.unit}</td>
                <td>{item.work_content}</td>
                <td>{item.start_time}</td>
                <td>{item.end_time ?? 'Chưa kết thúc'}</td>
                <td>{item.result_content ?? '-'}</td>
                <td className="actions">
                  {!item.end_time ? (
                    <button onClick={() => beginFinish(item.id)}>Kết thúc</button>
                  ) : null}
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
