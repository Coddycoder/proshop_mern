import React from 'react'
import { LinkContainer } from 'react-router-bootstrap'

const Step = ({ to, label, active, done }) => {
  const content = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        borderRadius: 'var(--radius-md)',
        fontSize: 13,
        fontWeight: 500,
        color: active
          ? 'var(--foreground)'
          : done
          ? 'var(--muted-fg)'
          : 'var(--muted)',
        backgroundColor: active ? 'var(--card-alt)' : 'transparent',
        border: active ? '1px solid var(--border)' : '1px solid transparent',
        cursor: done ? 'pointer' : 'default',
      }}
    >
      <span
        className='tabular-nums'
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: done
            ? 'var(--status-enabled)'
            : active
            ? 'var(--primary)'
            : 'var(--border)',
          color: done || active ? '#fff' : 'var(--muted)',
        }}
      >
        {done ? <i className='fas fa-check' aria-hidden='true' /> : null}
      </span>
      {label}
    </span>
  )

  return done && to ? (
    <LinkContainer to={to}>
      <a
        style={{ textDecoration: 'none' }}
        aria-current={active ? 'step' : undefined}
        href={to}
      >
        {content}
      </a>
    </LinkContainer>
  ) : (
    <span aria-current={active ? 'step' : undefined}>{content}</span>
  )
}

const CheckoutSteps = ({ step1, step2, step3, step4 }) => {
  // Active step = the latest unlocked step. Earlier unlocked = "done".
  const steps = [
    { id: 1, to: '/login', label: 'Sign In', unlocked: !!step1 },
    { id: 2, to: '/shipping', label: 'Shipping', unlocked: !!step2 },
    { id: 3, to: '/payment', label: 'Payment', unlocked: !!step3 },
    { id: 4, to: '/placeorder', label: 'Place Order', unlocked: !!step4 },
  ]

  let activeIndex = -1
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].unlocked) {
      activeIndex = i
      break
    }
  }

  return (
    <nav
      aria-label='Checkout progress'
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 32,
        paddingBottom: 16,
        borderBottom: '1px solid var(--border)',
      }}
    >
      {steps.map((s, i) => (
        <Step
          key={s.id}
          to={s.unlocked ? s.to : null}
          label={s.label}
          active={i === activeIndex}
          done={s.unlocked && i < activeIndex}
        />
      ))}
    </nav>
  )
}

export default CheckoutSteps
