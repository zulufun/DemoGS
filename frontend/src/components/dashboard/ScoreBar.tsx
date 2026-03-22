interface ScoreBarProps {
  score: number
}

export function ScoreBar({ score }: ScoreBarProps) {
  const safeScore = Math.max(0, Math.min(100, score))

  return (
    <section className="panel">
      <div className="score-line">
        <h2>Điểm sức khỏe hệ thống</h2>
        <strong>{safeScore}/100</strong>
      </div>
      <div className="score-bar">
        <div
          className="score-fill"
          style={{ width: `${safeScore}%` }}
          aria-label={`System score ${safeScore}`}
        />
      </div>
    </section>
  )
}
