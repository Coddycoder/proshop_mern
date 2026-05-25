import React, { useEffect } from 'react'
import { LinkContainer } from 'react-router-bootstrap'
import { Table, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import Paginate from '../components/Paginate'
import {
  listProducts,
  deleteProduct,
  createProduct,
} from '../actions/productActions'
import { PRODUCT_CREATE_RESET } from '../constants/productConstants'

const ProductListScreen = ({ history, match }) => {
  const pageNumber = match.params.pageNumber || 1

  const dispatch = useDispatch()

  const productList = useSelector((state) => state.productList)
  const { loading, error, products, page, pages } = productList

  const productDelete = useSelector((state) => state.productDelete)
  const {
    loading: loadingDelete,
    error: errorDelete,
    success: successDelete,
  } = productDelete

  const productCreate = useSelector((state) => state.productCreate)
  const {
    loading: loadingCreate,
    error: errorCreate,
    success: successCreate,
    product: createdProduct,
  } = productCreate

  const userLogin = useSelector((state) => state.userLogin)
  const { userInfo } = userLogin

  useEffect(() => {
    dispatch({ type: PRODUCT_CREATE_RESET })

    if (!userInfo || !userInfo.isAdmin) {
      history.push('/login')
    }

    if (successCreate) {
      history.push(`/admin/product/${createdProduct._id}/edit`)
    } else {
      dispatch(listProducts('', pageNumber))
    }
  }, [
    dispatch,
    history,
    userInfo,
    successDelete,
    successCreate,
    createdProduct,
    pageNumber,
  ])

  const deleteHandler = (id) => {
    if (window.confirm('Delete this product? This cannot be undone.')) {
      dispatch(deleteProduct(id))
    }
  }

  const createProductHandler = () => {
    dispatch(createProduct())
  }

  return (
    <>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <div>
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
          <h1 style={{ marginTop: 4, marginBottom: 4 }}>Products</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            Manage catalog inventory, pricing, and details.
          </p>
        </div>
        <Button onClick={createProductHandler}>
          <i className='fas fa-plus' aria-hidden='true' /> New product
        </Button>
      </header>

      {loadingDelete && <Loader inline label='Deleting' />}
      {errorDelete && <Message variant='danger'>{errorDelete}</Message>}
      {loadingCreate && <Loader inline label='Creating' />}
      {errorCreate && <Message variant='danger'>{errorCreate}</Message>}

      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : !products || products.length === 0 ? (
        <div className='ds-empty' role='status'>
          <div className='ds-empty__icon' aria-hidden='true'>
            <i className='fas fa-box' />
          </div>
          <div className='ds-empty__title'>No products yet</div>
          <div className='ds-empty__message'>
            Click "New product" to add the first item to the catalog.
          </div>
        </div>
      ) : (
        <>
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
                  <th>Price</th>
                  <th>Category</th>
                  <th>Brand</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <code style={{ fontSize: 12 }}>
                        {product._id.substring(0, 10)}…
                      </code>
                    </td>
                    <td>{product.name}</td>
                    <td className='tabular-nums'>${product.price}</td>
                    <td>{product.category}</td>
                    <td>{product.brand}</td>
                    <td>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <LinkContainer to={`/admin/product/${product._id}/edit`}>
                          <Button
                            variant='secondary'
                            className='btn-sm'
                            aria-label={`Edit ${product.name}`}
                          >
                            <i className='fas fa-edit' aria-hidden='true' />
                          </Button>
                        </LinkContainer>
                        <Button
                          variant='danger'
                          className='btn-sm'
                          onClick={() => deleteHandler(product._id)}
                          aria-label={`Delete ${product.name}`}
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
          <div style={{ marginTop: 24 }}>
            <Paginate pages={pages} page={page} isAdmin={true} />
          </div>
        </>
      )}
    </>
  )
}

export default ProductListScreen
