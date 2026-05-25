import React, { useEffect } from 'react'
import { LinkContainer } from 'react-router-bootstrap'
import { Table, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import { listOrders } from '../actions/orderActions'

const StatusPill = ({ ok, label, date }) => (
  <span className={`badge ${ok ? 'badge-enabled' : 'badge-disabled'}`}>
    {ok
      ? date
        ? date.substring(0, 10)
        : label
      : `Not ${label.toLowerCase()}`}
  </span>
)

const OrderListScreen = ({ history }) => {
  const dispatch = useDispatch()

  const orderList = useSelector((state) => state.orderList)
  const { loading, error, orders } = orderList

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  useEffect(() => {
    if (userInfo && userInfo.isAdmin) {
      dispatch(listOrders())
    } else {
      history.push('/login')
    }
  }, [dispatch, history, userInfo])

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
        <h1 style={{ marginTop: 4, marginBottom: 4 }}>Orders</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          {orders && orders.length > 0
            ? `${orders.length} order${orders.length === 1 ? '' : 's'} total.`
            : 'Customer orders will appear here.'}
        </p>
      </header>

      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : !orders || orders.length === 0 ? (
        <div className='ds-empty' role='status'>
          <div className='ds-empty__icon' aria-hidden='true'>
            <i className='fas fa-receipt' />
          </div>
          <div className='ds-empty__title'>No orders yet</div>
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
                <th>Customer</th>
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
                    <code style={{ fontSize: 12 }}>
                      {order._id.substring(0, 10)}…
                    </code>
                  </td>
                  <td>{order.user && order.user.name}</td>
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
                      <Button variant='secondary' className='btn-sm'>
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
    </>
  )
}

export default OrderListScreen
