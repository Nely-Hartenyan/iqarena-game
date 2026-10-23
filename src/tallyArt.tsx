const heights = [64, 42, 86, 58]

export function TallyArt() {
  return (
    <div className="art art-tally" aria-hidden="true">
      <span className="tally-glow" />
      <div className="tally-bars">
        {heights.map((height, index) => (
          <span key={height} style={{ ['--tally-h' as string]: `${height}%`, animationDelay: `${index * 0.16}s` }} />
        ))}
      </div>
    </div>
  )
}
