import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { AppEnv } from './types'

import authRoutes from './routes/auth.routes'
import itemsRoutes from './routes/items.routes'
import locationRoutes from './routes/location.routes'
import orderRoutes from './routes/order.routes'
import organizationRoutes from './routes/organization.routes'
import providerRoutes from './routes/provider.routes'
import userRoutes from './routes/user.routes'
import workingHoursRoutes from './routes/working-hours.routes'
import qrRoutes from './routes/qr.routes'
import tableRoutes from './routes/table.routes'
import seatRoutes from './routes/seat.routes'

const app = new Hono<AppEnv>()

// Allowed origins: exact production frontend, plus local dev origins
const ALLOWED_ORIGINS = [
  'https://cafe4x.pages.dev',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
]

// 1. Register CORS middleware first before all routes and auth middlewares
app.use(
  '*',
  cors({
    origin: (incomingOrigin) => {
      if (!incomingOrigin) return 'https://cafe4x.pages.dev'
      if (ALLOWED_ORIGINS.includes(incomingOrigin)) {
        return incomingOrigin
      }
      return 'https://cafe4x.pages.dev'
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Authorization',
      'Content-Type',
      'X-Organization-Id',
      'X-Shortcode',
      'X-User-Id',
      'x-organization-id',
      'x-shortcode',
      'x-user-id',
    ],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
  })
)

// 2. Global explicit OPTIONS handler to guarantee preflight responses
app.options('*', (c) => {
  return c.body(null, 204)
})

// 3. Mount API Routes
app.route('/api/auth', authRoutes)
app.route('/api/organizations', organizationRoutes)
app.route('/api/users', userRoutes)
app.route('/api/items', itemsRoutes)
app.route('/api/locations', locationRoutes)
app.route('/api/tables', tableRoutes)
app.route('/api/seats', seatRoutes)
app.route('/api/orders', orderRoutes)
app.route('/api/provider', providerRoutes)
app.route('/api/working-hours', workingHoursRoutes)
app.route('/api/qr', qrRoutes)

app.get('/', (c) => {
  return c.text('Hello Cafe4x Backend!')
})

app.get('/api/health', (c) => {
  return c.json({
    success: true,
    message: 'Cafe4x Backend is running!',
    timestamp: new Date().toISOString(),
  })
})

// 4. Global not-found handler (ensuring JSON and keeping CORS active)
app.notFound((c) => {
  return c.json({ success: false, message: 'Endpoint not found' }, 404)
})

// 5. Global error handler (ensuring JSON and keeping CORS active)
app.onError((err, c) => {
  console.error('Unhandled server error:', err)
  return c.json(
    {
      success: false,
      message: err.message || 'Internal Server Error',
    },
    500
  )
})

export default app
