import {
  FEATURE_FLAG_LIST_REQUEST,
  FEATURE_FLAG_LIST_SUCCESS,
  FEATURE_FLAG_LIST_FAIL,
} from '../constants/featureFlagConstants'

export const featureFlagListReducer = (state = { features: {} }, action) => {
  switch (action.type) {
    case FEATURE_FLAG_LIST_REQUEST:
      return { loading: true, features: {} }
    case FEATURE_FLAG_LIST_SUCCESS:
      return { loading: false, features: action.payload }
    case FEATURE_FLAG_LIST_FAIL:
      return { loading: false, error: action.payload }
    default:
      return state
  }
}
