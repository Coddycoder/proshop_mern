import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Button, Row, Col } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import CheckoutSteps from '../components/CheckoutSteps'
import { createOrder } from '../actions/orderActions'
import { ORDER_CREATE_RESET } from '../constants/orderConstants'
import { USER_DETAILS_RESET } from '../constants/userConstants'

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

const PlaceOrderScreen = ({ history }) => {
  const dispatch = useDispatch()

  const cart = useSelector((state) => state.cart)

  if (!cart.shippingAddress.address) {
    history.push('/shipping')
  } else if (!cart.paymentMethod) {
    history.push('/payment')
  }

  const addDecimals = (num) =>
    (Math.round(num * 100) / 100).toFixed(2)

  cart.itemsPrice = addDecimals(
    cart.cartItems.reduce((acc, item) => acc + item.price * item.qty, 0)
  )
  cart.shippingPrice = addDecimals(cart.itemsPrice > 100 ? 0 : 100)
  cart.taxPrice = addDecimals(Number((0.15 * cart.itemsPrice).toFixed(2)))
  cart.totalPrice = (
    Number(cart.itemsPrice) +
    Number(cart.shippingPrice) +
    Number(cart.taxPrice)
  ).toFixed(2)

  const orderCreate = useSelector((state) => state.orderCreate)
  const { order, success, error } = orderCreate

  useEffect(() => {
    if (success) {
      history.push(`/order/${order._id}`)
      dispatch({ type: USER_DETAILS_RESET })
      dispatch({ type: ORDER_CREATE_RESET })
    }
    // eslint-disable-next-line
  }, [history, success])

  const placeOrderHandler = () => {
    dispatch(
      createOrder({
        orderItems: cart.cartItems,
        shippingAddress: cart.shippingAddress,
        paymentMethod: cart.paymentMethod,
        itemsPrice: cart.itemsPrice,
        shippingPrice: cart.shippingPrice,
        taxPrice: cart.taxPrice,
        totalPrice: cart.totalPrice,
      })
    )
  }

  return (
    <>
      <CheckoutSteps step1 step2 step3 step4 />

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4, padding: 0 }}>Review your order</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          Double-check the details below and place your order when you’re ready.
        </p>
      </header>

      <Row>
        <Col md={8}>
          <Section title='Shipping address'>
            <p style={{ fontSize: 14, margin: 0, color: 'var(--muted-fg)' }}>
              {cart.shippingAddress.address}, {cart.shippingAddress.city}{' '}
              {cart.shippingAddress.postalCode}, {cart.shippingAddress.country}
            </p>
          </Section>

          <Section title='Payment method'>
            <p style={{ fontSize: 14, margin: 0, color: 'var(--muted-fg)' }}>
              <i className='fab fa-cc-paypal' aria-hidden='true' style={{ marginRight: 8 }} />
              {cart.paymentMethod}
            </p>
          </Section>

          <Section title={`Items (${cart.cartItems.length})`}>
            {cart.cartItems.length === 0 ? (
              <Message>Your cart is empty</Message>
            ) : (
              <div>
                {cart.cartItems.map((item, index) => (
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
            <SummaryRow label='Items' value={`$${cart.itemsPrice}`} />
            <SummaryRow label='Shipping' value={`$${cart.shippingPrice}`} />
            <SummaryRow label='Tax (15%)' value={`$${cart.taxPrice}`} />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8 }}>
              <SummaryRow label='Total' value={`$${cart.totalPrice}`} strong />
            </div>

            {error && (
              <div style={{ marginTop: 12 }}>
                <Message variant='danger'>{error}</Message>
              </div>
            )}

            <Button
              type='button'
              className='btn-block'
              disabled={cart.cartItems.length === 0}
              onClick={placeOrderHandler}
              style={{ marginTop: 16 }}
            >
              Place order
            </Button>
          </div>
        </Col>
      </Row>
    </>
  )
}

export default PlaceOrderScreen
