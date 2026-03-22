import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="panel">
      <h1>404</h1>
      <p>Không tìm thấy trang bạn yêu cầu.</p>
      <Link to="/dashboard">Quay về Dashboard</Link>
    </div>
  )
}
