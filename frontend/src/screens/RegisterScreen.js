import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Form, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import FormContainer from '../components/FormContainer'
import { register } from '../actions/userActions'

const RegisterScreen = ({ location, history }) => {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState(null)

  const dispatch = useDispatch()

  const userRegister = useSelector((state) => state.userRegister)
  const { loading, error, userInfo } = userRegister

  const redirect = location.search ? location.search.split('=')[1] : '/'

  useEffect(() => {
    if (userInfo) {
      history.push(redirect)
    }
  }, [history, userInfo, redirect])

  const submitHandler = (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
    } else {
      setMessage(null)
      dispatch(register(name, email, password))
    }
  }

  return (
    <FormContainer>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4, padding: 0 }}>Create account</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
          Less than a minute. Just an email and a password.
        </p>
      </header>

      {message && <Message variant='danger'>{message}</Message>}
      {error && <Message variant='danger'>{error}</Message>}
      {loading && <Loader inline label='Creating account' />}

      <Form onSubmit={submitHandler} className='ds-stack-md'>
        <Form.Group controlId='name'>
          <Form.Label>Name</Form.Label>
          <Form.Control
            type='text'
            placeholder='Your full name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete='name'
          />
        </Form.Group>

        <Form.Group controlId='email'>
          <Form.Label>Email address</Form.Label>
          <Form.Control
            type='email'
            placeholder='you@example.com'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete='email'
          />
        </Form.Group>

        <Form.Group controlId='password'>
          <Form.Label>Password</Form.Label>
          <Form.Control
            type='password'
            placeholder='At least 8 characters'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete='new-password'
          />
        </Form.Group>

        <Form.Group controlId='confirmPassword'>
          <Form.Label>Confirm password</Form.Label>
          <Form.Control
            type='password'
            placeholder='Re-enter your password'
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete='new-password'
          />
        </Form.Group>

        <Button type='submit' variant='primary' className='btn-block' disabled={loading}>
          Create account
        </Button>
      </Form>

      <p
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
          fontSize: 14,
          color: 'var(--muted)',
          textAlign: 'center',
          marginBottom: 0,
        }}
      >
        Already have an account?{' '}
        <Link to={redirect ? `/login?redirect=${redirect}` : '/login'}>Sign in</Link>
      </p>
    </FormContainer>
  )
}

export default RegisterScreen
