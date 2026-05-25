import React from 'react'
import { Link } from 'react-router-dom'
import { Card } from 'react-bootstrap'
import Rating from './Rating'

const Product = ({ product }) => {
  return (
    <Card className='my-3 h-100'>
      <Link
        to={`/product/${product._id}`}
        aria-label={`View ${product.name}`}
        style={{
          display: 'block',
          backgroundColor: 'var(--card-alt)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <Card.Img
          src={product.image}
          variant='top'
          style={{
            aspectRatio: '1 / 1',
            objectFit: 'contain',
            padding: 24,
            transition: 'transform 200ms ease',
          }}
        />
      </Link>

      <Card.Body
        style={{
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <Link
          to={`/product/${product._id}`}
          style={{
            color: 'var(--foreground)',
            textDecoration: 'none',
          }}
        >
          <Card.Title
            as='div'
            style={{
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.4,
              marginBottom: 0,
              minHeight: 44,
            }}
          >
            {product.name}
          </Card.Title>
        </Link>

        <Rating
          value={product.rating}
          text={`${product.numReviews} reviews`}
        />

        <Card.Text
          as='div'
          className='tabular-nums'
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--foreground)',
            marginTop: 'auto',
            marginBottom: 0,
            letterSpacing: '-0.01em',
          }}
        >
          ${product.price}
        </Card.Text>
      </Card.Body>
    </Card>
  )
}

export default Product
