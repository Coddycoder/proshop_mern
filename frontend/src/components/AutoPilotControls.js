import React, { useState } from 'react'

// CRA reads build-time env vars prefixed with REACT_APP_ (not Vite's import.meta.env).
// See frontend/.env.example. For M5 the key lives on the frontend as a simplification;
// in production the frontend would call its own backend, which holds the n8n key.
const N8N_URL = process.env.REACT_APP_N8N_WEBHOOK_URL
const N8N_API_KEY = process.env.REACT_APP_N8N_API_KEY

const ACTION_LABELS = {
  check: { idle: 'Запустить проверку', busy: 'Проверяем…' },
  test: { idle: 'Тестовый режим', busy: 'Включаем…' },
  rollback: { idle: 'Откатить фичу', busy: 'Откатываем…' },
  rollout: { idle: 'Применить трафик', busy: 'Меняем…' },
}

/**
 * Auto-Pilot Controls — sends a command to the WF1 n8n webhook, where an AI Agent
 * decides and turns the feature-flags MCP knobs, then returns a JSON verdict.
 * On success we ask the parent to re-read the source of truth (/api/feature-flags).
 */
const AutoPilotControls = ({ featureId, featureName, currentStatus, onUpdated }) => {
  const [loading, setLoading] = useState(null) // null | 'check' | 'test' | 'rollback' | 'rollout'
  const [feedback, setFeedback] = useState(null) // null | { type: 'success' | 'error', message }
  const [rolloutValue, setRolloutValue] = useState(25)

  const misconfigured = !N8N_URL

  const callAutoPilot = async (action, extras = {}) => {
    if (misconfigured) {
      setFeedback({
        type: 'error',
        message: 'REACT_APP_N8N_WEBHOOK_URL не задан. Скопируйте frontend/.env.example в .env.',
      })
      return
    }

    setLoading(action)
    setFeedback(null)

    try {
      const response = await fetch(`${N8N_URL}/feature-control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(N8N_API_KEY ? { 'X-API-Key': N8N_API_KEY } : {}),
        },
        body: JSON.stringify({ feature_id: featureId, action, ...extras }),
      })

      let result = {}
      try {
        result = await response.json()
      } catch (_) {
        result = {}
      }

      if (!response.ok || result.success === false) {
        setFeedback({
          type: 'error',
          message: result.message || `Запрос отклонён (HTTP ${response.status}).`,
        })
        return
      }

      setFeedback({ type: 'success', message: result.message || 'Готово.' })
      if (onUpdated) onUpdated(result.current_state)
    } catch (e) {
      setFeedback({ type: 'error', message: `Сеть: ${e.message}` })
    } finally {
      setLoading(null)
    }
  }

  const busy = loading !== null

  return (
    <div
      className='auto-pilot'
      aria-label={`Auto-Pilot Controls для ${featureName}`}
      style={{
        marginTop: 16,
        padding: 16,
        background: 'var(--card-alt)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <i className='fas fa-robot' aria-hidden='true' style={{ color: 'var(--accent)' }}></i>
        <strong style={{ fontSize: 14 }}>Auto-Pilot</strong>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>
          команда уходит в AI Agent (n8n) → MCP
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type='button'
          className='btn btn-secondary btn-sm'
          onClick={() => callAutoPilot('check')}
          disabled={busy}
        >
          {loading === 'check' ? ACTION_LABELS.check.busy : ACTION_LABELS.check.idle}
        </button>

        <button
          type='button'
          className='btn btn-primary btn-sm'
          onClick={() => callAutoPilot('test', { target_state: 'Testing' })}
          disabled={busy}
        >
          {loading === 'test' ? ACTION_LABELS.test.busy : ACTION_LABELS.test.idle}
        </button>

        <button
          type='button'
          className='btn btn-danger btn-sm'
          onClick={() => callAutoPilot('rollback', { target_state: 'Disabled' })}
          disabled={busy}
        >
          {loading === 'rollback' ? ACTION_LABELS.rollback.busy : ACTION_LABELS.rollback.idle}
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
        }}
      >
        <label
          htmlFor={`rollout-${featureId}`}
          style={{ margin: 0, fontSize: 13, color: 'var(--muted-fg)' }}
        >
          Трафик
        </label>
        <input
          id={`rollout-${featureId}`}
          type='number'
          min={0}
          max={100}
          step={5}
          value={rolloutValue}
          onChange={(e) => setRolloutValue(Number(e.target.value))}
          className='form-control tabular-nums'
          style={{ width: 88 }}
          aria-label={`Целевой процент трафика для ${featureName}`}
          disabled={busy}
        />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>%</span>
        <button
          type='button'
          className='btn btn-secondary btn-sm'
          onClick={() => callAutoPilot('rollout', { traffic_percentage: rolloutValue })}
          disabled={busy}
          title='Требует статус Testing'
        >
          {loading === 'rollout' ? ACTION_LABELS.rollout.busy : ACTION_LABELS.rollout.idle}
        </button>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          (rollout работает только в статусе Testing)
        </span>
      </div>

      {feedback && (
        <div
          className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-danger'}`}
          role='alert'
          style={{ marginTop: 16, marginBottom: 0 }}
        >
          <i
            className={`fas ${
              feedback.type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'
            }`}
            aria-hidden='true'
            style={{ marginRight: 8 }}
          ></i>
          {feedback.message}
        </div>
      )}

      {misconfigured && (
        <div
          style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}
          role='note'
        >
          Текущий статус: <strong>{currentStatus}</strong> · webhook не настроен.
        </div>
      )}
    </div>
  )
}

export default AutoPilotControls
