import React from 'react'

const Star = ({ filled, half, color }) => (
  <span aria-hidden='true'>
    <i
      style={{ color }}
      className={
        filled ? 'fas fa-star' : half ? 'fas fa-star-half-alt' : 'far fa-star'
      }
    ></i>
  </span>
)

const Rating = ({ value, text, color }) => {
  const stars = [1, 2, 3, 4, 5].map((threshold) => ({
    filled: value >= threshold,
    half: value >= threshold - 0.5 && value < threshold,
  }))

  return (
    <div
      className='rating'
      role='img'
      aria-label={`Rating: ${value} out of 5${text ? `, ${text}` : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
      }}
    >
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {stars.map((s, i) => (
          <Star key={i} filled={s.filled} half={s.half} color={color} />
        ))}
      </span>
      {text && <span style={{ color: 'var(--muted)' }}>{text}</span>}
    </div>
  )
}

Rating.defaultProps = {
  color: '#EAB308',
}

export default Rating
