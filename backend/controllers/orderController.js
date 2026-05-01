import asyncHandler from 'express-async-handler'
import Order from '../models/orderModel.js'
import Product from '../models/productModel.js'

const FREE_SHIPPING_THRESHOLD = 100
const FLAT_SHIPPING_PRICE = 100
const TAX_RATE = 0.15

const round2 = (n) => Math.round(n * 100) / 100

const calcPrices = (items) => {
  const itemsPrice = round2(
    items.reduce((acc, i) => acc + i.price * i.qty, 0)
  )
  const shippingPrice =
    itemsPrice > FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_PRICE
  const taxPrice = round2(itemsPrice * TAX_RATE)
  const totalPrice = round2(itemsPrice + shippingPrice + taxPrice)
  return { itemsPrice, shippingPrice, taxPrice, totalPrice }
}

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = asyncHandler(async (req, res) => {
  const { orderItems: requestedItems, shippingAddress, paymentMethod } = req.body

  if (!requestedItems || requestedItems.length === 0) {
    res.status(400)
    throw new Error('No order items')
  }

  const dbProducts = await Product.find({
    _id: { $in: requestedItems.map((i) => i.product) },
  })

  const orderItems = requestedItems.map((reqItem) => {
    const dbProduct = dbProducts.find(
      (p) => p._id.toString() === reqItem.product.toString()
    )
    if (!dbProduct) {
      res.status(400)
      throw new Error(`Product not found: ${reqItem.product}`)
    }
    return {
      name: dbProduct.name,
      qty: Number(reqItem.qty),
      image: dbProduct.image,
      price: dbProduct.price,
      product: dbProduct._id,
    }
  })

  const { itemsPrice, shippingPrice, taxPrice, totalPrice } = calcPrices(
    orderItems
  )

  const order = new Order({
    orderItems,
    user: req.user._id,
    shippingAddress,
    paymentMethod,
    itemsPrice,
    taxPrice,
    shippingPrice,
    totalPrice,
  })

  const createdOrder = await order.save()

  res.status(201).json(createdOrder)
})

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    'user',
    'name email'
  )

  if (order) {
    res.json(order)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Update order to paid
// @route   GET /api/orders/:id/pay
// @access  Private
const updateOrderToPaid = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)

  if (order) {
    order.isPaid = true
    order.paidAt = Date.now()
    order.paymentResult = {
      id: req.body.id,
      status: req.body.status,
      update_time: req.body.update_time,
      email_address: req.body.payer.email_address,
    }

    const updatedOrder = await order.save()

    res.json(updatedOrder)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Update order to delivered
// @route   GET /api/orders/:id/deliver
// @access  Private/Admin
const updateOrderToDelivered = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)

  if (order) {
    order.isDelivered = true
    order.deliveredAt = Date.now()

    const updatedOrder = await order.save()

    res.json(updatedOrder)
  } else {
    res.status(404)
    throw new Error('Order not found')
  }
})

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
  res.json(orders)
})

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({}).populate('user', 'id name')
  res.json(orders)
})

export {
  addOrderItems,
  getOrderById,
  updateOrderToPaid,
  updateOrderToDelivered,
  getMyOrders,
  getOrders,
}
