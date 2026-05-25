import React, { useEffect } from 'react'
import { LinkContainer } from 'react-router-bootstrap'
import { Table, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import { listUsers, deleteUser } from '../actions/userActions'

const UserListScreen = ({ history }) => {
  const dispatch = useDispatch()

  const userList = useSelector((state) => state.userList)
  const { loading, error, users } = userList

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const userDelete = useSelector((state) => state.userDelete)
  const { success: successDelete } = userDelete

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listUsers())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, successDelete, userInfo])

  const deleteHandler = (id) => {
    if (window.confirm('Delete this user? This cannot be undone.')) {
      dispatch(deleteUser(id))
    }
  }

  return (
    <>
      <header
        style={{
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--muted)',
            fontWeight: 500,
          }}
        >
          Admin
        </span>
        <h1 style={{ marginTop: 4, marginBottom: 4 }}>Users</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          {users && users.length > 0
            ? `${users.length} registered user${users.length === 1 ? '' : 's'}.`
            : 'Registered users will appear here.'}
        </p>
      </header>

      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : !users || users.length === 0 ? (
        <div className='ds-empty' role='status'>
          <div className='ds-empty__icon' aria-hidden='true'>
            <i className='fas fa-users' />
          </div>
          <div className='ds-empty__title'>No users yet</div>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <Table responsive className='mb-0'>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>
                    <code style={{ fontSize: 12 }}>{user._id.substring(0, 10)}…</code>
                  </td>
                  <td>{user.name}</td>
                  <td>
                    <a href={`mailto:${user.email}`}>{user.email}</a>
                  </td>
                  <td>
                    <span
                      className={`badge ${user.isAdmin ? 'badge-testing' : 'badge-disabled'}`}
                    >
                      {user.isAdmin ? 'Admin' : 'Customer'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <LinkContainer to={`/admin/user/${user._id}/edit`}>
                        <Button
                          variant='secondary'
                          className='btn-sm'
                          aria-label={`Edit ${user.name}`}
                        >
                          <i className='fas fa-edit' aria-hidden='true' />
                        </Button>
                      </LinkContainer>
                      <Button
                        variant='danger'
                        className='btn-sm'
                        onClick={() => deleteHandler(user._id)}
                        aria-label={`Delete ${user.name}`}
                      >
                        <i className='fas fa-trash' aria-hidden='true' />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </>
  )
}

export default UserListScreen
