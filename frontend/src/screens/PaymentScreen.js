import React, { useState } from 'react'
import { Form, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import FormContainer from '../components/FormContainer'
import CheckoutSteps from '../components/CheckoutSteps'
import { savePaymentMethod } from '../actions/cartActions'

const PaymentOption = ({ checked, onChange, label, description, icon }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: 16,
      border: `1px solid ${checked ? 'var(--foreground)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-md)',
      cursor: 'pointer',
      backgroundColor: checked ? 'var(--card-alt)' : 'var(--card)',
      transition: 'border-color 150ms ease, background-color 150ms ease',
      marginBottom: 0,
    }}
  >
    <input
      type='radio'
      name='paymentMethod'
      checked={checked}
      onChange={onChange}
      style={{ marginTop: 4 }}
      aria-label={label}
    />
    <span style={{ flex: 1 }}>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--foreground)',
        }}
      >
        {icon && <i className={icon} aria-hidden='true' />}
        {label}
      </span>
      {description && (
        <span style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginTop: 4 }}>
          {description}
        </span>
      )}
    </span>
  </label>
)

const PaymentScreen = ({ history }) => {
  const cart = useSelector((state) => state.cart)
  const { shippingAddress } = cart

  if (!shippingAddress.address) {
    history.push('/shipping')
  }

  const [paymentMethod, setPaymentMethod] = useState('PayPal')

  const dispatch = useDispatch()

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(savePaymentMethod(paymentMethod))
    history.push('/placeorder')
  }

  return (
    <>
      <CheckoutSteps step1 step2 step3 />
      <FormContainer>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 4, padding: 0 }}>Payment method</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
            Choose how you’d like to pay for this order.
          </p>
        </header>

        <Form onSubmit={submitHandler} className='ds-stack-md'>
          <fieldset>
            <legend className='sr-only'>Select payment method</legend>
            <PaymentOption
              checked={paymentMethod === 'PayPal'}
              onChange={() => setPaymentMethod('PayPal')}
              label='PayPal or credit card'
              description='You’ll be redirected to PayPal to complete payment securely.'
              icon='fab fa-cc-paypal'
            />
          </fieldset>

          <Button type='submit' variant='primary' className='btn-block'>
            Continue to review
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

export default PaymentScreen
