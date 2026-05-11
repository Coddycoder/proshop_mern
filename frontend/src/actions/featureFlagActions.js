import axios from 'axios'
import {
  FEATURE_FLAG_LIST_REQUEST,
  FEATURE_FLAG_LIST_SUCCESS,
  FEATURE_FLAG_LIST_FAIL,
} from '../constants/featureFlagConstants'

export const listFeatureFlags = () => async (dispatch) => {
  try {
    dispatch({ type: FEATURE_FLAG_LIST_REQUEST })

    const { data } = await axios.get('/api/feature-flags')

    dispatch({ type: FEATURE_FLAG_LIST_SUCCESS, payload: data })
  } catch (error) {
    dispatch({
      type: FEATURE_FLAG_LIST_FAIL,
      payload:
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message,
    })
  }
}
