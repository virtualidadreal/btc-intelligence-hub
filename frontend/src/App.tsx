import { lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ErrorBoundary from './components/common/ErrorBoundary'
import { I18nProvider } from './lib/i18n'

const Overview = lazy(() => import('./pages/Overview'))
const Trading = lazy(() => import('./pages/Trading'))
const Cycles = lazy(() => import('./pages/Cycles'))
const Technical = lazy(() => import('./pages/Technical'))
const OnChain = lazy(() => import('./pages/OnChain'))
const Macro = lazy(() => import('./pages/Macro'))
const Sentiment = lazy(() => import('./pages/Sentiment'))
const CycleScore = lazy(() => import('./pages/CycleScore'))
const Risk = lazy(() => import('./pages/Risk'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Conclusions = lazy(() => import('./pages/Conclusions'))
const Reports = lazy(() => import('./pages/Reports'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const Info = lazy(() => import('./pages/Info'))

export default function App() {
  return (
    <I18nProvider>
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/trading" element={<Trading />} />
            <Route path="/cycles" element={<Cycles />} />
            <Route path="/technical" element={<Technical />} />
            <Route path="/onchain" element={<OnChain />} />
            <Route path="/macro" element={<Macro />} />
            <Route path="/sentiment" element={<Sentiment />} />
            <Route path="/cycle-score" element={<CycleScore />} />
            <Route path="/risk" element={<Risk />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/conclusions" element={<Conclusions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/info" element={<Info />} />
          </Route>
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
    </I18nProvider>
  )
}
