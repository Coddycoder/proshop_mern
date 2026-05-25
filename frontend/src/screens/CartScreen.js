import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Row, Col, Form, Button } from 'react-bootstrap'
import { addToCart, removeFromCart } from '../actions/cartActions'

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

const CartScreen = ({ match, location, history }) => {
  const productId = match.params.id
  const qty = location.search ? Number(location.search.split('=')[1]) : 1

  const dispatch = useDispatch()

  const cart = useSelector((state) => state.cart)
  const { cartItems } = cart

  useEffect(() => {
    if (productId) {
      dispatch(addToCart(productId, qty))
    }
  }, [dispatch, productId, qty])

  const removeFromCartHandler = (id) => {
    dispatch(removeFromCart(id))
  }

  const checkoutHandler = () => {
    history.push('/login?redirect=shipping')
  }

  const itemCount = cartItems.reduce((acc, item) => acc + item.qty, 0)
  const subtotal = cartItems.reduce((acc, item) => acc + item.qty * item.price, 0)

  return (
    <>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Shopping cart</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
          {itemCount === 0
            ? 'Nothing here yet.'
            : `${itemCount} item${itemCount === 1 ? '' : 's'} ready for checkout.`}
        </p>
      </header>

      <Row>
        <Col md={8}>
          {cartItems.length === 0 ? (
            <div className='ds-empty' role='status'>
              <div className='ds-empty__icon' aria-hidden='true'>
                <i className='fas fa-shopping-cart' />
              </div>
              <div className='ds-empty__title'>Your cart is empty</div>
              <div className='ds-empty__message'>
                Browse the catalog and add a few items to get started.
              </div>
              <Link to='/' className='btn btn-primary btn-sm'>
                Browse products
              </Link>
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
              {cartItems.map((item, index) => (
                <div
                  key={item.product}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '64px 1fr auto auto auto',
                    gap: 16,
                    alignItems: 'center',
                    padding: '16px 20px',
                    borderTop:
                      index === 0 ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
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
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <Link
                      to={`/product/${item.product}`}
                      style={{
                        color: 'var(--foreground)',
                        fontWeight: 500,
                        fontSize: 14,
                        textDecoration: 'none',
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.name}
                    </Link>
                    <span
                      className='tabular-nums'
                      style={{ fontSize: 13, color: 'var(--muted)' }}
                    >
                      ${item.price} each
                    </span>
                  </div>

                  <Form.Control
                    as='select'
                    value={item.qty}
                    onChange={(e) =>
                      dispatch(addToCart(item.product, Number(e.target.value)))
                    }
                    aria-label={`Quantity for ${item.name}`}
                    style={{ width: 80 }}
                  >
                    {[...Array(item.countInStock).keys()].map((x) => (
                      <option key={x + 1} value={x + 1}>
                        {x + 1}
                      </option>
                    ))}
                  </Form.Control>

                  <span
                    className='tabular-nums'
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--foreground)',
                      minWidth: 70,
                      textAlign: 'right',
                    }}
                  >
                    ${(item.qty * item.price).toFixed(2)}
                  </span>

                  <Button
                    type='button'
                    variant='secondary'
                    onClick={() => removeFromCartHandler(item.product)}
                    aria-label={`Remove ${item.name} from cart`}
                    className='btn-sm'
                  >
                    <i className='fas fa-trash' aria-hidden='true' />
                  </Button>
                </div>
              ))}
            </div>
          )}
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
            <h2 style={{ fontSize: 18, marginBottom: 16, padding: 0 }}>
              Order summary
            </h2>
            <SummaryRow label={`Items (${itemCount})`} value={itemCount} />
            <SummaryRow
              label='Subtotal'
              value={`$${subtotal.toFixed(2)}`}
            />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8 }}>
              <SummaryRow
                label='Total'
                value={`$${subtotal.toFixed(2)}`}
                strong
              />
            </div>
            <Button
              type='button'
              className='btn-block'
              disabled={cartItems.length === 0}
              onClick={checkoutHandler}
              style={{ marginTop: 16 }}
            >
              Proceed to checkout
              <i
                className='fas fa-arrow-right'
                style={{ marginLeft: 8 }}
                aria-hidden='true'
              />
            </Button>
          </div>
        </Col>
      </Row>
    </>
  )
}

export default CartScreen
