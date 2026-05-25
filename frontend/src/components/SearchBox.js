import React, { useState } from 'react'

const SearchBox = ({ history }) => {
  const [keyword, setKeyword] = useState('')

  const submitHandler = (e) => {
    e.preventDefault()
    if (keyword.trim()) {
      history.push(`/search/${keyword}`)
    } else {
      history.push('/')
    }
  }

  return (
    <form
      onSubmit={submitHandler}
      role='search'
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginLeft: 16,
        marginRight: 16,
        flex: '1 1 320px',
        maxWidth: 480,
      }}
    >
      <label htmlFor='nav-search' className='sr-only'>
        Search products
      </label>
      <input
        id='nav-search'
        type='search'
        name='q'
        className='form-control'
        onChange={(e) => setKeyword(e.target.value)}
        placeholder='Search products…'
        aria-label='Search products'
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderColor: 'rgba(255, 255, 255, 0.18)',
          color: '#fff',
          fontSize: 14,
        }}
      />
      <button
        type='submit'
        className='btn btn-secondary btn-sm'
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderColor: 'rgba(255, 255, 255, 0.18)',
          color: '#fff',
          flexShrink: 0,
        }}
      >
        Search
      </button>
    </form>
  )
}

export default SearchBox
