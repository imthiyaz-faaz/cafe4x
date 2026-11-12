import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './pages/Admin/landingpage'
import UsersPage from './pages/Admin/Userspage'
import LocationPage from './pages/Admin/locationpage'
import ItemsPage from './pages/Admin/itemspage'
import OrdersPage from './pages/Admin/orderspages'
import WorkingHoursPage from './pages/Admin/workinghourspage'
import AdminReportPage from './pages/Admin/reportspage'
import ProviderPage from './pages/provider/providerpage'
import ProviderReportPage from './pages/provider/providerreportpage'
import ProviderPendingOrdersPage from './pages/provider/providerpendingorderspage'
import UserOrderPage from './pages/user/userorder'
import QrEntryPage from './pages/user/QrEntryPage'
import Home from './pages/Admin/login/homepage'
import Login from './pages/Admin/login/login'
import Signup from './pages/Admin/login/signup'
import ChooseOrganizationPage from './pages/Admin/login/chooseorganization'
import ProtectedRoute from './components/common/ProtectedRoute'
import LocationDetails from './pages/locations/LocationDetails'
import TableDetails from './pages/locations/TableDetails'

export default function App() {
  return (
    <Routes>
      {/* Public Guest Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Authenticated Organization Selection */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <ChooseOrganizationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/choose-organization"
        element={
          <ProtectedRoute>
            <ChooseOrganizationPage />
          </ProtectedRoute>
        }
      />

      {/* Authenticated Global/Default Admin & Provider Routes */}
      <Route
        path="/admin/location/:locationId/table/:tableId"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <TableDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/locationseats/:locationId"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <LocationDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/landing"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <LandingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/location"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <LocationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/items"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <ItemsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/working-hours"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <WorkingHoursPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['Admin']}>
            <AdminReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/reports"
        element={
          <ProtectedRoute allowedRoles={['Provider']}>
            <ProviderReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/pending-orders"
        element={
          <ProtectedRoute allowedRoles={['Provider']}>
            <ProviderPendingOrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider"
        element={
          <ProtectedRoute allowedRoles={['Provider']}>
            <ProviderPage />
          </ProtectedRoute>
        }
      />

      {/* Organization-specific routes with :shortCode prefix */}
      <Route
        path="/:shortCode/admin/location/:locationId/table/:tableId"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <TableDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/admin/locationseats/:locationId"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <LocationDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/landing"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <LandingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/users"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/location"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <LocationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/items"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <ItemsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/orders"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/working-hours"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <WorkingHoursPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/reports"
        element={
          <ProtectedRoute allowedRoles={['Admin']} requireOrgMatch>
            <AdminReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/provider/reports"
        element={
          <ProtectedRoute allowedRoles={['Provider']} requireOrgMatch>
            <ProviderReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/provider/pending-orders"
        element={
          <ProtectedRoute allowedRoles={['Provider']} requireOrgMatch>
            <ProviderPendingOrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/:shortCode/provider"
        element={
          <ProtectedRoute allowedRoles={['Provider']} requireOrgMatch>
            <ProviderPage />
          </ProtectedRoute>
        }
      />

      {/* Order Entry routes — validate permanent employee or seat QR, create temporary session, redirect */}
      <Route path="/order" element={<UserOrderPage />} />
      <Route path="/:shortCode/order" element={<UserOrderPage />} />
      <Route path="/:shortCode/order/:seatToken" element={<QrEntryPage />} />
      <Route path="/order/:seatToken" element={<QrEntryPage />} />
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
