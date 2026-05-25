import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Carousel } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from './Message'
import { listTopProducts } from '../actions/productActions'

const ProductCarousel = () => {
  const dispatch = useDispatch()

  const productTopRated = useSelector((state) => state.productTopRated)
  const { loading, error, products } = productTopRated

  useEffect(() => {
    dispatch(listTopProducts())
  }, [dispatch])

  if (loading) {
    return (
      <div
        className='ds-skeleton'
        style={{
          width: '100%',
          height: 280,
          borderRadius: 'var(--radius-lg)',
          marginTop: 16,
        }}
        aria-hidden='true'
      />
    )
  }

  if (error) return <Message variant='danger'>{error}</Message>

  return (
    <Carousel
      pause='hover'
      interval={5000}
      style={{
        marginTop: 24,
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 0,
        overflow: 'hidden',
      }}
      indicators={products && products.length > 1}
    >
      {(products || []).map((product) => (
        <Carousel.Item key={product._id}>
          <Link
            to={`/product/${product._id}`}
            aria-label={`View ${product.name}`}
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)',
                alignItems: 'center',
                gap: 32,
                padding: '32px 48px',
                minHeight: 280,
              }}
              className='carousel-grid'
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--muted)',
                    fontWeight: 500,
                    marginBottom: 12,
                  }}
                >
                  Top rated
                </span>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--foreground)',
                    marginBottom: 12,
                    lineHeight: 1.2,
                    padding: 0,
                  }}
                >
                  {product.name}
                </h2>
                <div
                  className='tabular-nums'
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: 'var(--foreground)',
                  }}
                >
                  ${product.price}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: 'var(--card-alt)',
                  borderRadius: 'var(--radius-md)',
                  padding: 16,
                  height: '100%',
                  maxHeight: 240,
                }}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  style={{
                    maxHeight: 200,
                    maxWidth: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>
            </div>
          </Link>
        </Carousel.Item>
      ))}
    </Carousel>
  )
}

export default ProductCarousel
