import React, { useEffect } from 'react'
import { Table, Badge, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import { listFeatureFlags } from '../actions/featureFlagActions'

const statusVariant = (status) => {
  if (status === 'Enabled') return 'success'
  if (status === 'Testing') return 'warning'
  if (status === 'Disabled') return 'secondary'
  return 'light'
}

const FeatureFlagListScreen = ({ history }) => {
  const dispatch = useDispatch()

  const featureFlagList = useSelector((state) => state.featureFlagList)
  const { loading, error, features } = featureFlagList

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listFeatureFlags())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, userInfo])

  const entries = features ? Object.entries(features) : []

  return (
    <>
      <h1>Dashboard Features</h1>
      <p className='text-muted'>
        Live view of <code>backend/features.json</code>. Mutated via the
        feature-flags MCP server; refresh to see latest state.
      </p>
      <Button
        variant='light'
        className='btn-sm mb-3'
        onClick={() => dispatch(listFeatureFlags())}
      >
        <i className='fas fa-sync'></i> Refresh
      </Button>
      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <Table striped bordered hover responsive className='table-sm'>
          <thead>
            <tr>
              <th>ID</th>
              <th>NAME</th>
              <th>STATUS</th>
              <th>TRAFFIC %</th>
              <th>LAST MODIFIED</th>
              <th>DEPENDS ON</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([id, f]) => (
              <tr key={id}>
                <td>
                  <code>{id}</code>
                </td>
                <td>
                  {f.name}
                  {f.description && (
                    <div className='text-muted small'>{f.description}</div>
                  )}
                </td>
                <td>
                  <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                </td>
                <td>{f.traffic_percentage}%</td>
                <td>{f.last_modified}</td>
                <td>
                  {f.dependencies && f.dependencies.length > 0
                    ? f.dependencies.map((d) => (
                        <code key={d} className='d-block'>
                          {d}
                        </code>
                      ))
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  )
}

export default FeatureFlagListScreen
