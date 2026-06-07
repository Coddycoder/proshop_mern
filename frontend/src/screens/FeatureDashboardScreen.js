import React, { useEffect, useMemo, useState } from 'react'
import { Container, Row, Col } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import { listFeatureFlags } from '../actions/featureFlagActions'
import AutoPilotControls from '../components/AutoPilotControls'

const STATUS_FILTERS = ['All', 'Enabled', 'Testing', 'Disabled']

const badgeClassFor = (status) => {
  switch (status) {
    case 'Enabled':
      return 'badge badge-enabled'
    case 'Testing':
      return 'badge badge-testing'
    case 'Disabled':
    default:
      return 'badge badge-disabled'
  }
}

const StatusBadge = ({ status }) => (
  <span className={badgeClassFor(status)} aria-label={`Status: ${status}`}>
    {status}
  </span>
)

const Toggle = ({ checked, onChange, label }) => (
  <label className='ds-toggle' aria-label={label}>
    <input
      type='checkbox'
      role='switch'
      aria-checked={checked}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className='ds-toggle__track'>
      <span className='ds-toggle__thumb' />
    </span>
  </label>
)

const Slider = ({ value, onChange, label }) => (
  <input
    type='range'
    min={0}
    max={100}
    step={5}
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    className='ds-slider'
    style={{
      backgroundSize: `${value}% 100%`,
    }}
    aria-label={label}
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
  />
)

const SkeletonCard = () => (
  <div className='card mb-3' aria-hidden='true'>
    <div className='card-body'>
      <div className='ds-skeleton' style={{ width: '40%', height: 18 }} />
      <div className='ds-skeleton' style={{ width: '80%', height: 14, marginTop: 12 }} />
      <div className='ds-skeleton' style={{ width: '60%', height: 14, marginTop: 8 }} />
      <div className='ds-skeleton' style={{ width: '100%', height: 24, marginTop: 20 }} />
    </div>
  </div>
)

const EmptyState = ({ onReset }) => (
  <div className='ds-empty' role='status'>
    <div className='ds-empty__icon' aria-hidden='true'>
      <i className='fas fa-search'></i>
    </div>
    <div className='ds-empty__title'>No features match your filter</div>
    <div className='ds-empty__message'>
      Try a different search term or clear the active filter.
    </div>
    <button type='button' className='btn btn-secondary btn-sm' onClick={onReset}>
      Clear filters
    </button>
  </div>
)

const ErrorState = ({ message, onRetry }) => (
  <div className='alert alert-danger' role='alert'>
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <i className='fas fa-exclamation-triangle' style={{ marginTop: 2 }} aria-hidden='true'></i>
      <div style={{ flex: 1 }}>
        <strong>Failed to load features.</strong>
        <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>{message}</div>
      </div>
      <button
        type='button'
        className='btn btn-sm btn-danger'
        onClick={onRetry}
        style={{ flexShrink: 0 }}
      >
        Retry
      </button>
    </div>
  </div>
)

const FeatureCard = ({
  id,
  feature,
  uiStatus,
  uiTraffic,
  onToggle,
  onTrafficChange,
  isSelected,
  onSelectToggle,
  onUpdated,
}) => {
  const isEnabled = uiStatus === 'Enabled'
  return (
    <div
      className='card mb-3'
      style={isSelected ? { borderColor: 'var(--accent)' } : undefined}
    >
      <div className='card-body'>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            marginBottom: 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, padding: 0, fontSize: 18 }}>{feature.name}</h3>
              <StatusBadge status={uiStatus} />
            </div>
            <code style={{ fontSize: 12, color: 'var(--muted)' }}>{id}</code>
            {feature.description && (
              <p
                style={{
                  marginTop: 12,
                  marginBottom: 0,
                  fontSize: 14,
                  color: 'var(--muted-fg)',
                  lineHeight: 1.55,
                }}
              >
                {feature.description}
              </p>
            )}
          </div>
          <Toggle
            checked={isEnabled}
            onChange={(next) => onToggle(id, next)}
            label={`Toggle ${feature.name}`}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 13,
                color: 'var(--muted-fg)',
                marginBottom: 6,
              }}
            >
              <label htmlFor={`slider-${id}`} style={{ margin: 0 }}>
                Traffic rollout
              </label>
              <span className='tabular-nums' style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                {uiTraffic}%
              </span>
            </div>
            <Slider
              value={uiTraffic}
              onChange={(next) => onTrafficChange(id, next)}
              label={`Traffic percentage for ${feature.name}`}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              fontSize: 13,
              color: 'var(--muted)',
              paddingTop: 8,
              borderTop: '1px solid var(--border)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--muted-fg)', fontWeight: 500 }}>
                Modified:
              </strong>{' '}
              <span className='tabular-nums'>{feature.last_modified}</span>
            </span>
            {feature.rollout_strategy && (
              <span>
                <strong style={{ color: 'var(--muted-fg)', fontWeight: 500 }}>
                  Strategy:
                </strong>{' '}
                {feature.rollout_strategy}
              </span>
            )}
            {feature.dependencies && feature.dependencies.length > 0 && (
              <span>
                <strong style={{ color: 'var(--muted-fg)', fontWeight: 500 }}>
                  Depends on:
                </strong>{' '}
                {feature.dependencies.map((d, i) => (
                  <code key={d} style={{ marginRight: 6 }}>
                    {d}
                    {i < feature.dependencies.length - 1 ? ',' : ''}
                  </code>
                ))}
              </span>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type='button'
            className='btn btn-secondary btn-sm'
            onClick={() => onSelectToggle(id)}
            aria-expanded={isSelected}
            aria-controls={`autopilot-${id}`}
          >
            <i className='fas fa-robot' aria-hidden='true'></i>{' '}
            {isSelected ? 'Скрыть Auto-Pilot' : 'Auto-Pilot'}
          </button>
        </div>

        {isSelected && (
          <div id={`autopilot-${id}`}>
            <AutoPilotControls
              featureId={id}
              featureName={feature.name}
              currentStatus={uiStatus}
              onUpdated={() => onUpdated(id)}
            />
          </div>
        )}
      </div>
    </div>
  )
}

const FeatureDashboardScreen = ({ history }) => {
  const dispatch = useDispatch()

  const featureFlagList = useSelector((state) => state.featureFlagList)
  const { loading, error, features } = featureFlagList

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  // Local UI-only overrides (M4: optimistic UI; M5 will wire real mutations)
  const [statusOverrides, setStatusOverrides] = useState({})
  const [trafficOverrides, setTrafficOverrides] = useState({})

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  // Which feature has its Auto-Pilot (n8n) panel expanded.
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listFeatureFlags())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, userInfo])

  const entries = useMemo(
    () => (features ? Object.entries(features) : []),
    [features]
  )

  const getStatus = (id, original) => statusOverrides[id] || original
  const getTraffic = (id, original) =>
    trafficOverrides[id] !== undefined ? trafficOverrides[id] : original

  const handleToggle = (id, next) => {
    setStatusOverrides((prev) => ({
      ...prev,
      [id]: next ? 'Enabled' : 'Disabled',
    }))
  }

  const handleTraffic = (id, value) => {
    setTrafficOverrides((prev) => ({ ...prev, [id]: value }))
  }

  const handleSelectToggle = (id) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  // After the agent mutated the flag via MCP, drop any optimistic override for
  // this feature and re-read the source of truth so the card shows real state.
  const handleUpdated = (id) => {
    setStatusOverrides((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setTrafficOverrides((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    dispatch(listFeatureFlags())
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries.filter(([id, f]) => {
      const status = getStatus(id, f.status)
      if (statusFilter !== 'All' && status !== statusFilter) return false
      if (!q) return true
      return (
        id.toLowerCase().includes(q) ||
        (f.name || '').toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q)
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, search, statusFilter, statusOverrides])

  const counts = useMemo(() => {
    const c = { All: entries.length, Enabled: 0, Testing: 0, Disabled: 0 }
    entries.forEach(([id, f]) => {
      const s = getStatus(id, f.status)
      if (c[s] !== undefined) c[s] += 1
    })
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, statusOverrides])

  const handleReset = () => {
    setSearch('')
    setStatusFilter('All')
  }

  return (
    <Container className='py-3'>
      <Row>
        <Col>
          <header style={{ marginBottom: 32 }}>
            <h1 style={{ marginBottom: 8 }}>Feature Dashboard</h1>
            <p
              style={{
                color: 'var(--muted-fg)',
                fontSize: 15,
                marginBottom: 0,
                maxWidth: 720,
              }}
            >
              Live view of <code>backend/features.json</code>. Toggle status and
              adjust traffic rollout to preview changes locally, or open{' '}
              <strong>Auto-Pilot</strong> on a feature to send a command to the
              n8n AI Agent — it turns the feature-flags MCP knobs and reports
              back, then the card refreshes from the source of truth.
            </p>
          </header>

          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              gap: 16,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 24,
              paddingBottom: 24,
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ flex: '1 1 240px', minWidth: 240 }}>
              <label htmlFor='ff-search' className='sr-only'>
                Search features
              </label>
              <input
                id='ff-search'
                type='search'
                className='form-control'
                placeholder='Search by name, id, or description…'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label='Search features'
              />
            </div>

            <div
              role='radiogroup'
              aria-label='Filter by status'
              style={{
                display: 'inline-flex',
                gap: 4,
                padding: 4,
                background: 'var(--card-alt)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border)',
              }}
            >
              {STATUS_FILTERS.map((s) => {
                const active = statusFilter === s
                return (
                  <button
                    key={s}
                    type='button'
                    role='radio'
                    aria-checked={active}
                    onClick={() => setStatusFilter(s)}
                    style={{
                      border: 'none',
                      background: active ? 'var(--card)' : 'transparent',
                      color: active ? 'var(--foreground)' : 'var(--muted)',
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      padding: '6px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      transition: 'background-color 150ms ease, color 150ms ease',
                    }}
                  >
                    {s}{' '}
                    <span className='tabular-nums' style={{ opacity: 0.6 }}>
                      ({counts[s]})
                    </span>
                  </button>
                )
              })}
            </div>

            <button
              type='button'
              className='btn btn-secondary btn-sm'
              onClick={() => dispatch(listFeatureFlags())}
              aria-label='Refresh features list'
            >
              <i className='fas fa-sync' aria-hidden='true'></i> Refresh
            </button>
          </div>

          {/* States */}
          {loading ? (
            <div aria-live='polite' aria-busy='true'>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : error ? (
            <ErrorState
              message={error}
              onRetry={() => dispatch(listFeatureFlags())}
            />
          ) : filtered.length === 0 ? (
            <EmptyState onReset={handleReset} />
          ) : (
            <div aria-live='polite'>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--muted)',
                  marginBottom: 16,
                }}
              >
                Showing{' '}
                <span className='tabular-nums' style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                  {filtered.length}
                </span>{' '}
                of{' '}
                <span className='tabular-nums'>{entries.length}</span> features
              </div>
              {filtered.map(([id, f]) => (
                <FeatureCard
                  key={id}
                  id={id}
                  feature={f}
                  uiStatus={getStatus(id, f.status)}
                  uiTraffic={getTraffic(id, f.traffic_percentage)}
                  onToggle={handleToggle}
                  onTrafficChange={handleTraffic}
                  isSelected={selectedId === id}
                  onSelectToggle={handleSelectToggle}
                  onUpdated={handleUpdated}
                />
              ))}
            </div>
          )}
        </Col>
      </Row>
    </Container>
  )
}

export default FeatureDashboardScreen
