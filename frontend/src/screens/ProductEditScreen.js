import axios from 'axios'
import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Form, Button, Row, Col } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import { listProductDetails, updateProduct } from '../actions/productActions'
import { PRODUCT_UPDATE_RESET } from '../constants/productConstants'

const FormSection = ({ title, description, children }) => (
  <section
    style={{
      backgroundColor: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 24,
      marginBottom: 16,
    }}
  >
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 16, marginBottom: 4, padding: 0 }}>{title}</h2>
      {description && (
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
          {description}
        </p>
      )}
    </div>
    <div className='ds-stack-md'>{children}</div>
  </section>
)

const ProductEditScreen = ({ match, history }) => {
  const productId = match.params.id

  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [image, setImage] = useState('')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [countInStock, setCountInStock] = useState(0)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)

  const dispatch = useDispatch()

  const productDetails = useSelector((state) => state.productDetails)
  const { loading, error, product } = productDetails

  const productUpdate = useSelector((state) => state.productUpdate)
  const {
    loading: loadingUpdate,
    error: errorUpdate,
    success: successUpdate,
  } = productUpdate

  useEffect(() => {
    if (successUpdate) {
      dispatch({ type: PRODUCT_UPDATE_RESET })
      history.push('/admin/productlist')
    } else {
      if (!product.name || product._id !== productId) {
        dispatch(listProductDetails(productId))
      } else {
        setName(product.name)
        setPrice(product.price)
        setImage(product.image)
        setBrand(product.brand)
        setCategory(product.category)
        setCountInStock(product.countInStock)
        setDescription(product.description)
      }
    }
  }, [dispatch, history, productId, product, successUpdate])

  const uploadFileHandler = async (e) => {
    const file = e.target.files[0]
    const formData = new FormData()
    formData.append('image', file)
    setUploading(true)

    try {
      const config = {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
      const { data } = await axios.post('/api/upload', formData, config)
      setImage(data)
      setUploading(false)
    } catch (err) {
      console.error(err)
      setUploading(false)
    }
  }

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(
      updateProduct({
        _id: productId,
        name,
        price,
        image,
        brand,
        category,
        description,
        countInStock,
      })
    )
  }

  return (
    <>
      <Link
        to='/admin/productlist'
        className='btn btn-secondary btn-sm'
        style={{ marginTop: 16, marginBottom: 16 }}
      >
        <i className='fas fa-arrow-left' aria-hidden='true' /> Back to products
      </Link>

      <header style={{ marginBottom: 24 }}>
        <span
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--muted)',
            fontWeight: 500,
          }}
        >
          Admin · Edit product
        </span>
        <h1 style={{ marginTop: 4, marginBottom: 0, padding: 0 }}>
          {name || 'Edit product'}
        </h1>
      </header>

      {loadingUpdate && <Loader inline label='Saving' />}
      {errorUpdate && <Message variant='danger'>{errorUpdate}</Message>}

      {loading ? (
        <Loader />
      ) : error ? (
        <Message variant='danger'>{error}</Message>
      ) : (
        <Form onSubmit={submitHandler}>
          <Row>
            <Col md={8}>
              <FormSection title='Basics' description='Product name and description shown to customers.'>
                <Form.Group controlId='name'>
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type='text'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Form.Group>

                <Form.Group controlId='description'>
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as='textarea'
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Form.Group>
              </FormSection>

              <FormSection title='Image' description='URL or upload — uploaded files land in /uploads.'>
                <Form.Group controlId='image'>
                  <Form.Label>Image URL</Form.Label>
                  <Form.Control
                    type='text'
                    placeholder='/uploads/...'
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                  />
                  <div style={{ marginTop: 12 }}>
                    <Form.File
                      id='image-file'
                      label='Choose file'
                      custom
                      onChange={uploadFileHandler}
                    />
                  </div>
                  {uploading && (
                    <div style={{ marginTop: 8 }}>
                      <Loader inline label='Uploading' />
                    </div>
                  )}
                </Form.Group>
              </FormSection>
            </Col>

            <Col md={4}>
              <FormSection title='Pricing & stock'>
                <Form.Group controlId='price'>
                  <Form.Label>Price (USD)</Form.Label>
                  <Form.Control
                    type='number'
                    step='0.01'
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </Form.Group>

                <Form.Group controlId='countInStock'>
                  <Form.Label>Count in stock</Form.Label>
                  <Form.Control
                    type='number'
                    value={countInStock}
                    onChange={(e) => setCountInStock(e.target.value)}
                  />
                </Form.Group>
              </FormSection>

              <FormSection title='Categorization'>
                <Form.Group controlId='brand'>
                  <Form.Label>Brand</Form.Label>
                  <Form.Control
                    type='text'
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                  />
                </Form.Group>

                <Form.Group controlId='category'>
                  <Form.Label>Category</Form.Label>
                  <Form.Control
                    type='text'
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                </Form.Group>
              </FormSection>

              <Button type='submit' variant='primary' className='btn-block'>
                Save product
              </Button>
            </Col>
          </Row>
        </Form>
      )}
    </>
  )
}

export default ProductEditScreen
