import React, { useState } from 'react'
import { Form, Button, Row, Col } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import FormContainer from '../components/FormContainer'
import CheckoutSteps from '../components/CheckoutSteps'
import { saveShippingAddress } from '../actions/cartActions'

const ShippingScreen = ({ history }) => {
  const cart = useSelector((state) => state.cart)
  const { shippingAddress } = cart

  const [address, setAddress] = useState(shippingAddress.address || '')
  const [city, setCity] = useState(shippingAddress.city || '')
  const [postalCode, setPostalCode] = useState(shippingAddress.postalCode || '')
  const [country, setCountry] = useState(shippingAddress.country || '')

  const dispatch = useDispatch()

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(saveShippingAddress({ address, city, postalCode, country }))
    history.push('/payment')
  }

  return (
    <>
      <CheckoutSteps step1 step2 />
      <FormContainer>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 4, padding: 0 }}>Shipping address</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
            Where should we send your order?
          </p>
        </header>

        <Form onSubmit={submitHandler} className='ds-stack-md'>
          <Form.Group controlId='address'>
            <Form.Label>Street address</Form.Label>
            <Form.Control
              type='text'
              placeholder='123 Main Street'
              value={address}
              required
              onChange={(e) => setAddress(e.target.value)}
              autoComplete='street-address'
            />
          </Form.Group>

          <Row>
            <Col sm={7}>
              <Form.Group controlId='city'>
                <Form.Label>City</Form.Label>
                <Form.Control
                  type='text'
                  placeholder='San Francisco'
                  value={city}
                  required
                  onChange={(e) => setCity(e.target.value)}
                  autoComplete='address-level2'
                />
              </Form.Group>
            </Col>
            <Col sm={5}>
              <Form.Group controlId='postalCode'>
                <Form.Label>Postal code</Form.Label>
                <Form.Control
                  type='text'
                  placeholder='94103'
                  value={postalCode}
                  required
                  onChange={(e) => setPostalCode(e.target.value)}
                  autoComplete='postal-code'
                />
              </Form.Group>
            </Col>
          </Row>

          <Form.Group controlId='country'>
            <Form.Label>Country</Form.Label>
            <Form.Control
              type='text'
              placeholder='United States'
              value={country}
              required
              onChange={(e) => setCountry(e.target.value)}
              autoComplete='country-name'
            />
          </Form.Group>

          <Button type='submit' variant='primary' className='btn-block'>
            Continue to payment
            <i
              className='fas fa-arrow-right'
              style={{ marginLeft: 8 }}
              aria-hidden='true'
            />
          </Button>
        </Form>
      </FormContainer>
    </>
  )
}

export default ShippingScreen
