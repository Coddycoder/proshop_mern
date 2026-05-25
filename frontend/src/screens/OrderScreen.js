import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { PayPalButton } from 'react-paypal-button-v2'
import { Link } from 'react-router-dom'
import { Row, Col, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import {
  getOrderDetails,
  payOrder,
  deliverOrder,
} from '../actions/orderActions'
import {
  ORDER_PAY_RESET,
  ORDER_DELIVER_RESET,
} from '../constants/orderConstants'

const Section = ({ title, children }) => (
  <section
    style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      marginBottom: 16,
    }}
  >
    <h2 style={{ fontSize: 16, marginBottom: 12, padding: 0 }}>{title}</h2>
    {children}
  </section>
)

const SummaryRow = ({ label, value, strong = false }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      fontSize: strong ? 16 : 14,
      fontWeight: strong ? 600 : 400,
      color: strong ? 'var(--foreground)' : 'var(--muted-fg)',
    }}
  >
    <span>{label}</span>
    <span className='tabular-nums'>{value}</span>
  </div>
)

const StatusBadge = ({ ok, label, date }) => (
  <span className={`badge ${ok ? 'badge-enabled' : 'badge-disabled'}`}>
    {ok
      ? `${label} · ${date ? date.substring(0, 10) : 'yes'}`
      : `Not ${label.toLowerCase()}`}
  </span>
)

const OrderScreen = ({ match, history }) => {
  const orderId = match.params.id

  const [sdkReady, setSdkReady] = useState(false)

  const dispatch = useDispatch()

  const orderDetails = useSelector((state) => state.orderDetails)
  const { order, loading, error } = orderDetails

  const orderPay = useSelector((state) => state.orderPay)
  const { loading: loadingPay, success: successPay } = orderPay

  const orderDeliver = useSelector((state) => state.orderDeliver)
  const { loading: loadingDeliver, success: successDeliver } = orderDeliver

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  if (!loading && order) {
    const addDecimals = (num) =>
      (Math.round(num * 100) / 100).toFixed(2)

    order.itemsPrice = addDecimals(
      order.orderItems.reduce((acc, item) => acc + item.price * item.qty, 0)
    )
  }

  useEffect(() => {
    if (!userInfo) {
      history.push('/login')
    }

    const addPayPalScript = async () => {
      const { data: clientId } = await axios.get('/api/config/paypal')
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}`
      script.async = true
      script.onload = () => {
        setSdkReady(true)
      }
      document.body.appendChild(script)
    }

    if (!order || successPay || successDeliver || order._id !== orderId) {
      dispatch({ type: ORDER_PAY_RESET })
      dispatch({ type: ORDER_DELIVER_RESET })
      dispatch(getOrderDetails(orderId))
    } else if (!order.isPaid) {
      if (!window.paypal) {
        addPayPalScript()
      } else {
        setSdkReady(true)
      }
    }
  }, [dispatch, orderId, successPay, successDeliver, order])

  return loading ? (
    <Loader />
  ) : error ? (
    <Message variant='danger'>{error}</Message>
  ) : (
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
          Order
        </span>
        <h1
          style={{
            fontSize: 22,
            marginTop: 4,
            marginBottom: 12,
            padding: 0,
            fontFamily: 'var(--font-mono)',
            wordBreak: 'break-all',
          }}
        >
          {order._id}
        </h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <StatusBadge ok={order.isPaid} label='Paid' date={order.paidAt} />
          <StatusBadge
            ok={order.isDelivered}
            label='Delivered'
            date={order.deliveredAt}
          />
        </div>
      </header>

      <Row>
        <Col md={8}>
          <Section title='Customer'>
            <div style={{ fontSize: 14, color: 'var(--muted-fg)' }}>
              <p style={{ margin: 0 }}>
                <strong style={{ color: 'var(--foreground)' }}>{order.user.name}</strong>
              </p>
              <p style={{ margin: '4px 0 0 0' }}>
                <a href={`mailto:${order.user.email}`}>{order.user.email}</a>
              </p>
            </div>
          </Section>

          <Section title='Shipping address'>
            <p style={{ fontSize: 14, margin: 0, color: 'var(--muted-fg)' }}>
              {order.shippingAddress.address}, {order.shippingAddress.city}{' '}
              {order.shippingAddress.postalCode}, {order.shippingAddress.country}
            </p>
          </Section>

          <Section title='Payment method'>
            <p style={{ fontSize: 14, margin: 0, color: 'var(--muted-fg)' }}>
              <i className='fab fa-cc-paypal' aria-hidden='true' style={{ marginRight: 8 }} />
              {order.paymentMethod}
            </p>
          </Section>

          <Section title={`Items (${order.orderItems.length})`}>
            {order.orderItems.length === 0 ? (
              <Message>Order is empty</Message>
            ) : (
              <div>
                {order.orderItems.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '48px 1fr auto',
                      gap: 16,
                      alignItems: 'center',
                      padding: '12px 0',
                      borderTop: index === 0 ? 'none' : '1px solid var(--border)',
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        backgroundColor: 'var(--card-alt)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      />
                    </div>
                    <Link
                      to={`/product/${item.product}`}
                      style={{
                        color: 'var(--foreground)',
                        fontSize: 14,
                        textDecoration: 'none',
                      }}
                    >
                      {item.name}
                    </Link>
                    <span
                      className='tabular-nums'
                      style={{ fontSize: 14, color: 'var(--muted-fg)' }}
                    >
                      {item.qty} × ${item.price} ={' '}
                      <strong style={{ color: 'var(--foreground)' }}>
                        ${(item.qty * item.price).toFixed(2)}
                      </strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </Col>

        <Col md={4}>
          <div
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              position: 'sticky',
              top: 24,
            }}
          >
            <h2 style={{ fontSize: 18, marginBottom: 16, padding: 0 }}>Order summary</h2>
            <SummaryRow label='Items' value={`$${order.itemsPrice}`} />
            <SummaryRow label='Shipping' value={`$${order.shippingPrice}`} />
            <SummaryRow label='Tax' value={`$${order.taxPrice}`} />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8 }}>
              <SummaryRow label='Total' value={`$${order.totalPrice}`} strong />
            </div>

            {!order.isPaid && (
              <div style={{ marginTop: 16 }}>
                {loadingPay && <Loader inline label='Processing payment' />}
                {!sdkReady ? (
                  <Loader inline label='Loading PayPal' />
                ) : (
                  <PayPalButton
                    amount={order.totalPrice}
                    onSuccess={(paymentResult) =>
                      dispatch(payOrder(orderId, paymentResult))
                    }
                  />
                )}
              </div>
            )}

            {loadingDeliver && <Loader inline label='Updating' />}
            {userInfo &&
              userInfo.isAdmin &&
              order.isPaid &&
              !order.isDelivered && (
                <Button
                  type='button'
                  className='btn-block'
                  onClick={() => dispatch(deliverOrder(order))}
                  style={{ marginTop: 16 }}
                >
                  Mark as delivered
                </Button>
              )}
          </div>
        </Col>
      </Row>
    </>
  )
}

export default OrderScreen
