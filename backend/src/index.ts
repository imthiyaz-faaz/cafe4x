import { Hono } from 'hono'
import { cors } from 'hono/cors'

import authRoutes from './routes/auth.routes'
import itemsRoutes from './routes/items.routes'
import locationRoutes from './routes/location.routes'
import orderRoutes from './routes/order.routes'
import providerRoutes from './routes/provider.routes'
import userRoutes from './routes/user.routes'
import workingHoursRoutes from './routes/working-hours.routes'

const app = new Hono()

app.use('*', cors())

app.route('/api/auth', authRoutes)
app.route('/api/users', userRoutes)
app.route('/api/items', itemsRoutes)
app.route('/api/locations', locationRoutes)
app.route('/api/orders', orderRoutes)
app.route('/api/provider', providerRoutes)
app.route('/api/working-hours', workingHoursRoutes)




app.get('/', (c) => {
  return c.text('Hello Cafe4x Backend!')
})

export default app
