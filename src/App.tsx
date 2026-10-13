import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/landingpage'
import UsersPage from './pages/Userspage'
import Home from './pages/login/homepage'
import Login from './pages/login/login'
import Signup from './pages/login/signup'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
