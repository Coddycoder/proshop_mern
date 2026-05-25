import React from 'react'
import { Container, Row, Col } from 'react-bootstrap'

const Footer = () => {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        marginTop: 48,
        backgroundColor: 'var(--card)',
      }}
    >
      <Container>
        <Row>
          <Col
            className='text-center'
            style={{
              padding: '24px 0',
              color: 'var(--muted)',
              fontSize: 13,
              letterSpacing: '0.02em',
            }}
          >
            © {new Date().getFullYear()} ProShop — minimal-tech e-commerce
          </Col>
        </Row>
      </Container>
    </footer>
  )
}

export default Footer
