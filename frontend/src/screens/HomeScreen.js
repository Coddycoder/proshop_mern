import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Row, Col } from 'react-bootstrap'
import Product from '../components/Product'
import Message from '../components/Message'
import Paginate from '../components/Paginate'
import ProductCarousel from '../components/ProductCarousel'
import Meta from '../components/Meta'
import { listProducts } from '../actions/productActions'

const Hero = () => (
  <section
    style={{
      padding: '64px 0 48px',
      borderBottom: '1px solid var(--border)',
      marginBottom: 48,
    }}
  >
    <div style={{ maxWidth: 720 }}>
      <span
        style={{
          display: 'inline-block',
          fontSize: 12,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--muted)',
          marginBottom: 16,
        }}
      >
        ProShop · Latest 2026
      </span>
      <h1
        style={{
          fontSize: 48,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          fontWeight: 700,
          marginBottom: 16,
          padding: 0,
        }}
      >
        Equipment, gear, and everyday tools — curated.
      </h1>
      <p
        style={{
          fontSize: 17,
          lineHeight: 1.6,
          color: 'var(--muted-fg)',
          marginBottom: 24,
        }}
      >
        A small catalog of well-priced electronics. Browse the latest below or
        search by name above.
      </p>
    </div>
    <ProductCarousel />
  </section>
)

const ProductSkeleton = () => (
  <Col sm={12} md={6} lg={4} xl={3}>
    <div className='card my-3' aria-hidden='true'>
      <div
        className='ds-skeleton'
        style={{ aspectRatio: '1 / 1', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}
      />
      <div className='card-body'>
        <div className='ds-skeleton' style={{ width: '80%', height: 16, marginBottom: 12 }} />
        <div className='ds-skeleton' style={{ width: '50%', height: 14, marginBottom: 16 }} />
        <div className='ds-skeleton' style={{ width: '30%', height: 24 }} />
      </div>
    </div>
  </Col>
)

const HomeScreen = ({ match }) => {
  const keyword = match.params.keyword
  const pageNumber = match.params.pageNumber || 1

  const dispatch = useDispatch()

  const productList = useSelector((state) => state.productList)
  const { loading, error, products, page, pages } = productList

  useEffect(() => {
    dispatch(listProducts(keyword, pageNumber))
  }, [dispatch, keyword, pageNumber])

  return (
    <>
      <Meta />

      {!keyword ? (
        <Hero />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
            paddingBottom: 16,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
              }}
            >
              Search results
            </span>
            <h1 style={{ fontSize: 24, marginTop: 4, marginBottom: 0, padding: 0 }}>
              "{keyword}"
            </h1>
          </div>
          <Link to='/' className='btn btn-secondary btn-sm'>
            <i className='fas fa-arrow-left' aria-hidden='true' /> Back to all
          </Link>
        </div>
      )}

      {!keyword && (
        <h2 style={{ marginBottom: 24 }}>Latest Products</h2>
      )}

      {loading ? (
        <Row>
          {[0, 1, 2, 3].map((i) => (
            <ProductSkeleton key={i} />
          ))}
        </Row>
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : products.length === 0 ? (
        <div className='ds-empty' role='status'>
          <div className='ds-empty__icon' aria-hidden='true'>
            <i className='fas fa-search' />
          </div>
          <div className='ds-empty__title'>No products found</div>
          <div className='ds-empty__message'>
            Try a different keyword or browse the full catalog.
          </div>
          <Link to='/' className='btn btn-secondary btn-sm'>
            Browse all products
          </Link>
        </div>
      ) : (
        <>
          <Row>
            {products.map((product) => (
              <Col key={product._id} sm={12} md={6} lg={4} xl={3} className='d-flex'>
                <div style={{ width: '100%' }}>
                  <Product product={product} />
                </div>
              </Col>
            ))}
          </Row>
          <div style={{ marginTop: 32 }}>
            <Paginate
              pages={pages}
              page={page}
              keyword={keyword ? keyword : ''}
            />
          </div>
        </>
      )}
    </>
  )
}

export default HomeScreen
