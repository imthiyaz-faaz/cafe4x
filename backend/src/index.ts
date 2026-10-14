import { Hono } from 'hono'
import { cors } from 'hono/cors'

import authRoutes from './routes/auth.routes'
import itemsRoutes from './routes/items.routes'

const app = new Hono()

app.use('*', cors())

app.route('/api/auth', authRoutes)
app.route('/api/items', itemsRoutes)

app.get('/', (c) => {
  return c.text('Hello Cafe4x Backend!')
})

export default app
