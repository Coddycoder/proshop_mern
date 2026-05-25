import React from 'react'

const Loader = ({ inline = false, label = 'Loading' }) => {
  if (inline) {
    return (
      <span
        role='status'
        aria-live='polite'
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--muted)',
          fontSize: 14,
        }}
      >
        <span
          className='ds-skeleton'
          style={{
            display: 'inline-block',
            width: 14,
            height: 14,
            borderRadius: '50%',
          }}
          aria-hidden='true'
        />
        {label}
      </span>
    )
  }

  return (
    <div
      role='status'
      aria-live='polite'
      aria-busy='true'
      style={{ width: '100%' }}
    >
      <span className='sr-only'>{label}…</span>
      <div
        className='ds-skeleton'
        style={{ width: '60%', height: 20, marginBottom: 12 }}
      />
      <div
        className='ds-skeleton'
        style={{ width: '100%', height: 14, marginBottom: 8 }}
      />
      <div
        className='ds-skeleton'
        style={{ width: '85%', height: 14, marginBottom: 8 }}
      />
      <div
        className='ds-skeleton'
        style={{ width: '70%', height: 14 }}
      />
    </div>
  )
}

export default Loader
