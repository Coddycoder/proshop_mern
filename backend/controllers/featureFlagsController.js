import path from 'path'
import fs from 'fs/promises'
import asyncHandler from 'express-async-handler'

const FEATURES_FILE = path.join(path.resolve(), 'backend', 'features.json')

const readFeatures = async () => {
  const raw = await fs.readFile(FEATURES_FILE, 'utf-8')
  return JSON.parse(raw)
}

// @desc    Get all feature flags
// @route   GET /api/feature-flags
// @access  Public (admin-only consumed by Dashboard Features in UI)
const getFeatureFlags = asyncHandler(async (req, res) => {
  const features = await readFeatures()
  res.json(features)
})

// @desc    Get a single feature flag by id
// @route   GET /api/feature-flags/:name
// @access  Public
const getFeatureFlagByName = asyncHandler(async (req, res) => {
  const features = await readFeatures()
  const feature = features[req.params.name]
  if (!feature) {
    res.status(404)
    throw new Error(`Feature '${req.params.name}' not found`)
  }
  res.json({ feature_id: req.params.name, ...feature })
})

export { getFeatureFlags, getFeatureFlagByName }
