import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'

const FormContainer = ({ children }) => {
  return (
    <Container>
      <Row className='justify-content-md-center'>
        <Col xs={12} md={7} lg={5}>
          <div
            style={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 32,
              marginTop: 24,
            }}
          >
            {children}
          </div>
        </Col>
      </Row>
    </Container>
  )
}

export default FormContainer
