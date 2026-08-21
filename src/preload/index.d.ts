import type { NoketokiApi } from './index'

declare global {
  interface Window {
    noketoki: NoketokiApi
  }
}

export {}
