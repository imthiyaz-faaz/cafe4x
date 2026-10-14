import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/Admin/landingpage'
import UsersPage from './pages/Admin/Userspage'
import LocationPage from './pages/Admin/locationpage'
import ItemsPage from './pages/Admin/itemspage'
import OrdersPage from './pages/Admin/orderspages'
import WorkingHoursPage from './pages/Admin/workinghourspage'
import ProviderPage from './pages/provider/providerpage'
import UserOrderPage from './pages/user/userorder'
import Home from './pages/Admin/login/homepage'
import Login from './pages/Admin/login/login'
import Signup from './pages/Admin/login/signup'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/location" element={<LocationPage />} />
      <Route path="/items" element={<ItemsPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/working-hours" element={<WorkingHoursPage />} />
      <Route path="/provider" element={<ProviderPage />} />
      <Route path="/FTS/Provider" element={<ProviderPage />} />
      {/* Employee / Guest Order QR routes */}
      <Route path="/emporder" element={<UserOrderPage />} />
      <Route path="/order/:locationId/:seatNumber" element={<UserOrderPage />} />
      <Route path="/FTS/qrorder/:qrToken" element={<UserOrderPage />} />
      <Route path="/qrorder/:qrToken" element={<UserOrderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
