import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/Admin/landingpage'
import UsersPage from './pages/Admin/Userspage'
import LocationPage from './pages/Admin/locationpage'
import ItemsPage from './pages/Admin/itemspage'
import OrdersPage from './pages/Admin/orderspages'
import WorkingHoursPage from './pages/Admin/workinghourspage'
import ProviderPage from './pages/provider/providerpage'
import UserOrderPage from './pages/user/userorder'
import QrEntryPage from './pages/user/QrEntryPage'
import Home from './pages/Admin/login/homepage'
import Login from './pages/Admin/login/login'
import Signup from './pages/Admin/login/signup'
import ChooseOrganizationPage from './pages/Admin/login/chooseorganization'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<ChooseOrganizationPage />} />
      <Route path="/choose-organization" element={<ChooseOrganizationPage />} />
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

      {/* Organization-specific routes with :shortCode prefix */}
      <Route path="/:shortCode/landing" element={<LandingPage />} />
      <Route path="/:shortCode/users" element={<UsersPage />} />
      <Route path="/:shortCode/location" element={<LocationPage />} />
      <Route path="/:shortCode/items" element={<ItemsPage />} />
      <Route path="/:shortCode/orders" element={<OrdersPage />} />
      <Route path="/:shortCode/working-hours" element={<WorkingHoursPage />} />
      <Route path="/:shortCode/provider" element={<ProviderPage />} />

      {/* Order Entry routes — validate permanent employee or seat QR, create temporary session, redirect */}
      <Route path="/order/:locationId/:seatNumber" element={<QrEntryPage />} />
      <Route path="/:shortCode/order/:locationId/:seatNumber" element={<QrEntryPage />} />
      <Route path="/:shortCode/employee/:permanentToken" element={<QrEntryPage />} />
      <Route path="/employee/:permanentToken" element={<QrEntryPage />} />

      {/* Temporary ordering session routes — served after session is created */}
      <Route path="/:shortCode/qrorder/:qrToken" element={<UserOrderPage />} />
      <Route path="/qrorder/:qrToken" element={<UserOrderPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
