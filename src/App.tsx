import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/landingpage'
import Home from './pages/login/homepage'
import Login from './pages/login/login'
import Signup from './pages/login/signup'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/home" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
