import React from 'react'
import { Alert } from 'react-bootstrap'

const Message = ({ variant, children }) => {
  const role = variant === 'danger' ? 'alert' : 'status'
  return (
    <Alert variant={variant} role={role}>
      {children}
    </Alert>
  )
}

Message.defaultProps = {
  variant: 'info',
}

export default Message
