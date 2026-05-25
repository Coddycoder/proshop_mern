import React, { useState, useEffect } from 'react'
import { Form, Button, Row, Col, Table } from 'react-bootstrap'
import { LinkContainer } from 'react-router-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import { getUserDetails, updateUserProfile } from '../actions/userActions'
import { listMyOrders } from '../actions/orderActions'
import { USER_UPDATE_PROFILE_RESET } from '../constants/userConstants'

const StatusPill = ({ ok, label, date }) => (
  <span
    className={`badge ${ok ? 'badge-enabled' : 'badge-disabled'}`}
    title={ok && date ? date : undefined}
  >
    {ok ? `${label} · ${date ? date.substring(0, 10) : 'yes'}` : `Not ${label.toLowerCase()}`}
  </span>
)

const ProfileScreen = ({ location, history }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)

  const dispatch = useDispatch()

  const userDetails = useSelector((state) => state.userDetails)
  const { loading, error, user } = userDetails

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const userUpdateProfile = useSelector((state) => state.userUpdateProfile)
  const { success } = userUpdateProfile

  const orderListMy = useSelector((state) => state.orderListMy)
  const { loading: loadingOrders, error: errorOrders, orders } = orderListMy

  useEffect(() => {
    if (!userInfo) {
      history.push('/login')
    } else {
      if (!user || !user.name || success) {
        dispatch({ type: USER_UPDATE_PROFILE_RESET })
        dispatch(getUserDetails('profile'))
        dispatch(listMyOrders())
      } else {
        setName(user.name)
        setEmail(user.email)
      }
    }
  }, [dispatch, history, userInfo, user, success])

  const submitHandler = (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
    } else {
      setMessage(null)
      dispatch(updateUserProfile({ id: user._id, name, email, password }))
    }
  }

  return (
    <>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ marginBottom: 4 }}>Your account</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          Manage your profile and review order history.
        </p>
      </header>

      <Row>
        <Col md={4}>
          <div
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
            }}
          >
            <h2 style={{ fontSize: 18, marginBottom: 16, padding: 0 }}>Profile</h2>

            {message && <Message variant='danger'>{message}</Message>}
            {success && <Message variant='success'>Profile updated.</Message>}

            {loading ? (
              <Loader />
            ) : error ? (
              <Message variant='danger'>{error}</Message>
            ) : (
              <Form onSubmit={submitHandler} className='ds-stack-md'>
                <Form.Group controlId='name'>
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type='text'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete='name'
                  />
                </Form.Group>

                <Form.Group controlId='email'>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type='email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete='email'
                  />
                </Form.Group>

                <Form.Group controlId='password'>
                  <Form.Label>New password</Form.Label>
                  <Form.Control
                    type='password'
                    placeholder='Leave blank to keep current'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete='new-password'
                  />
                </Form.Group>

                <Form.Group controlId='confirmPassword'>
                  <Form.Label>Confirm new password</Form.Label>
                  <Form.Control
                    type='password'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete='new-password'
                  />
                </Form.Group>

                <Button type='submit' variant='primary' className='btn-block'>
                  Update profile
                </Button>
              </Form>
            )}
          </div>
        </Col>

        <Col md={8}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, marginBottom: 4, padding: 0 }}>My orders</h2>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
              Past purchases and their current status.
            </p>
          </div>

          {loadingOrders ? (
            <Loader />
          ) : errorOrders ? (
            <Message variant='danger'>{errorOrders}</Message>
          ) : !orders || orders.length === 0 ? (
            <div className='ds-empty' role='status'>
              <div className='ds-empty__icon' aria-hidden='true'>
                <i className='fas fa-box-open' />
              </div>
              <div className='ds-empty__title'>No orders yet</div>
              <div className='ds-empty__message'>
                Once you place an order, it will appear here.
              </div>
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
                    <th>Order</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Delivered</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td>
                        <code style={{ fontSize: 12 }}>{order._id.substring(0, 10)}…</code>
                      </td>
                      <td className='tabular-nums'>
                        {order.createdAt.substring(0, 10)}
                      </td>
                      <td className='tabular-nums'>${order.totalPrice}</td>
                      <td>
                        <StatusPill ok={order.isPaid} label='Paid' date={order.paidAt} />
                      </td>
                      <td>
                        <StatusPill
                          ok={order.isDelivered}
                          label='Delivered'
                          date={order.deliveredAt}
                        />
                      </td>
                      <td>
                        <LinkContainer to={`/order/${order._id}`}>
                          <Button className='btn-sm' variant='secondary'>
                            Details
                          </Button>
                        </LinkContainer>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Col>
      </Row>
    </>
  )
}

export default ProfileScreen
