import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Form, Button } from 'react-bootstrap'
import { useDispatch, useSelector } from 'react-redux'
import Message from '../components/Message'
import Loader from '../components/Loader'
import FormContainer from '../components/FormContainer'
import { login } from '../actions/userActions'

const LoginScreen = ({ location, history }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const dispatch = useDispatch()

  const userLogin = useSelector((state) => state.userLogin)
  const { loading, error, userInfo } = userLogin

  const redirect = location.search ? location.search.split('=')[1] : '/'

  useEffect(() => {
    if (userInfo) {
      history.push(redirect)
    }
  }, [history, userInfo, redirect])

  const submitHandler = (e) => {
    e.preventDefault()
    dispatch(login(email, password))
  }

  return (
    <FormContainer>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, marginBottom: 4, padding: 0 }}>Sign in</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
          Welcome back. Enter your credentials to continue.
        </p>
      </header>

      {error && <Message variant='danger'>{error}</Message>}
      {loading && <Loader inline label='Signing in' />}

      <Form onSubmit={submitHandler} className='ds-stack-md'>
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
            placeholder='Your password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete='current-password'
          />
        </Form.Group>

        <Button type='submit' variant='primary' className='btn-block' disabled={loading}>
          Sign in
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
        New to ProShop?{' '}
        <Link to={redirect ? `/register?redirect=${redirect}` : '/register'}>
          Create an account
        </Link>
      </p>
    </FormContainer>
  )
}

export default LoginScreen
