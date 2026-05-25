import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Row, Col, Form, Button } from 'react-bootstrap'
import Rating from '../components/Rating'
import Message from '../components/Message'
import Loader from '../components/Loader'
import Meta from '../components/Meta'
import {
  listProductDetails,
  createProductReview,
} from '../actions/productActions'
import { PRODUCT_CREATE_REVIEW_RESET } from '../constants/productConstants'

const Stat = ({ label, value }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
      fontSize: 14,
    }}
  >
    <span style={{ color: 'var(--muted)' }}>{label}</span>
    <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{value}</span>
  </div>
)

const ProductScreen = ({ history, match }) => {
  const [qty, setQty] = useState(1)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  const dispatch = useDispatch()

  const productDetails = useSelector((state) => state.productDetails)
  const { loading, error, product } = productDetails

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  const productReviewCreate = useSelector((state) => state.productReviewCreate)
  const {
    success: successProductReview,
    loading: loadingProductReview,
    error: errorProductReview,
  } = productReviewCreate

  useEffect(() => {
    if (successProductReview) {
      setRating(0)
      setComment('')
    }
    if (!product._id || product._id !== match.params.id) {
      dispatch(listProductDetails(match.params.id))
      dispatch({ type: PRODUCT_CREATE_REVIEW_RESET })
    }
  }, [dispatch, match, successProductReview])

  const addToCartHandler = () => {
    history.push(`/cart/${match.params.id}?qty=${qty}`)
  }

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(
      createProductReview(match.params.id, {
        rating,
        comment,
      })
    )
  }

  const inStock = product && product.countInStock > 0

  return (
    <>
      <Link
        className='btn btn-secondary btn-sm'
        to='/'
        style={{ marginTop: 16, marginBottom: 24 }}
      >
        <i className='fas fa-arrow-left' aria-hidden='true' /> Back to catalog
      </Link>

      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <>
          <Meta title={product.name} />

          <Row>
            <Col md={6}>
              <div
                style={{
                  backgroundColor: 'var(--card-alt)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 32,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: 360,
                }}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  style={{ maxWidth: '100%', maxHeight: 400, objectFit: 'contain' }}
                />
              </div>
            </Col>

            <Col md={6}>
              <div style={{ marginTop: 0 }}>
                <h1
                  style={{
                    fontSize: 28,
                    lineHeight: 1.2,
                    marginBottom: 12,
                    padding: 0,
                  }}
                >
                  {product.name}
                </h1>
                <div style={{ marginBottom: 16 }}>
                  <Rating
                    value={product.rating}
                    text={`${product.numReviews} reviews`}
                  />
                </div>

                <div
                  className='tabular-nums'
                  style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    letterSpacing: '-0.01em',
                    marginBottom: 24,
                  }}
                >
                  ${product.price}
                </div>

                <p
                  style={{
                    fontSize: 15,
                    color: 'var(--muted-fg)',
                    lineHeight: 1.65,
                    marginBottom: 24,
                  }}
                >
                  {product.description}
                </p>

                <div
                  style={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 24,
                  }}
                >
                  <Stat
                    label='Price'
                    value={<span className='tabular-nums'>${product.price}</span>}
                  />
                  <Stat
                    label='Availability'
                    value={
                      <span
                        className={`badge ${inStock ? 'badge-enabled' : 'badge-disabled'}`}
                      >
                        {inStock ? 'In stock' : 'Out of stock'}
                      </span>
                    }
                  />

                  {inStock && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '16px 0',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <label
                        htmlFor='qty'
                        style={{
                          fontSize: 14,
                          color: 'var(--muted)',
                          margin: 0,
                          minWidth: 60,
                        }}
                      >
                        Quantity
                      </label>
                      <Form.Control
                        id='qty'
                        as='select'
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                        style={{ maxWidth: 100 }}
                      >
                        {[...Array(product.countInStock).keys()].map((x) => (
                          <option key={x + 1} value={x + 1}>
                            {x + 1}
                          </option>
                        ))}
                      </Form.Control>
                    </div>
                  )}

                  <Button
                    onClick={addToCartHandler}
                    className='btn-block'
                    type='button'
                    disabled={!inStock}
                    style={{ marginTop: 20 }}
                    aria-label={inStock ? 'Add to cart' : 'Out of stock'}
                  >
                    {inStock ? (
                      <>
                        <i className='fas fa-shopping-cart' aria-hidden='true' />{' '}
                        Add to cart
                      </>
                    ) : (
                      'Out of stock'
                    )}
                  </Button>
                </div>
              </div>
            </Col>
          </Row>

          <section style={{ marginTop: 48 }}>
            <h2 style={{ marginBottom: 24 }}>Reviews</h2>

            <Row>
              <Col md={7}>
                {product.reviews.length === 0 ? (
                  <div className='ds-empty' role='status'>
                    <div className='ds-empty__icon' aria-hidden='true'>
                      <i className='far fa-comment-dots' />
                    </div>
                    <div className='ds-empty__title'>No reviews yet</div>
                    <div className='ds-empty__message'>
                      Be the first to share your thoughts on this product.
                    </div>
                  </div>
                ) : (
                  <div className='ds-stack-md'>
                    {product.reviews.map((review) => (
                      <div
                        key={review._id}
                        style={{
                          padding: 20,
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-lg)',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 8,
                          }}
                        >
                          <strong style={{ fontSize: 14 }}>{review.name}</strong>
                          <span
                            className='tabular-nums'
                            style={{ fontSize: 12, color: 'var(--muted)' }}
                          >
                            {review.createdAt.substring(0, 10)}
                          </span>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <Rating value={review.rating} />
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            color: 'var(--muted-fg)',
                            lineHeight: 1.55,
                          }}
                        >
                          {review.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Col>

              <Col md={5}>
                <div
                  style={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 24,
                  }}
                >
                  <h3 style={{ fontSize: 18, marginBottom: 16, padding: 0 }}>
                    Write a review
                  </h3>

                  {successProductReview && (
                    <Message variant='success'>
                      Review submitted successfully.
                    </Message>
                  )}
                  {loadingProductReview && <Loader inline label='Submitting' />}
                  {errorProductReview && (
                    <Message variant='danger'>{errorProductReview}</Message>
                  )}

                  {userInfo ? (
                    <Form onSubmit={submitHandler}>
                      <Form.Group controlId='rating'>
                        <Form.Label>Rating</Form.Label>
                        <Form.Control
                          as='select'
                          value={rating}
                          onChange={(e) => setRating(e.target.value)}
                          required
                        >
                          <option value=''>Select…</option>
                          <option value='1'>1 — Poor</option>
                          <option value='2'>2 — Fair</option>
                          <option value='3'>3 — Good</option>
                          <option value='4'>4 — Very good</option>
                          <option value='5'>5 — Excellent</option>
                        </Form.Control>
                      </Form.Group>
                      <Form.Group controlId='comment'>
                        <Form.Label>Comment</Form.Label>
                        <Form.Control
                          as='textarea'
                          rows='4'
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder='What stood out for you?'
                        />
                      </Form.Group>
                      <Button
                        disabled={loadingProductReview}
                        type='submit'
                        variant='primary'
                        className='btn-block'
                      >
                        Submit review
                      </Button>
                    </Form>
                  ) : (
                    <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
                      Please <Link to='/login'>sign in</Link> to write a review.
                    </p>
                  )}
                </div>
              </Col>
            </Row>
          </section>
        </>
      )}
    </>
  )
}

export default ProductScreen
