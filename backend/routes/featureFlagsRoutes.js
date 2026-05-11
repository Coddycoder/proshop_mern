import express from 'express'
import {
  getFeatureFlags,
  getFeatureFlagByName,
} from '../controllers/featureFlagsController.js'

const router = express.Router()

router.route('/').get(getFeatureFlags)
router.route('/:name').get(getFeatureFlagByName)

export default router
