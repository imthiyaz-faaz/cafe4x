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

const app = new Hono<AppEnv>()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'x-shortcode',
      'x-organization-id',
      'x-user-id',
    ],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
  })
)

app.route('/api/auth', authRoutes)
app.route('/api/organizations', organizationRoutes)
app.route('/api/users', userRoutes)
app.route('/api/items', itemsRoutes)
app.route('/api/locations', locationRoutes)
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

export default app
