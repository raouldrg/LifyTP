
import { buildApp } from './app'

const PORT = Number(process.env.API_PORT ?? 3000)

const app = await buildApp()

// --- DEBUG : affiche toutes les routes connues
app.ready().then(() => {
  console.log(app.printRoutes())
})

try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  app.log.info(`API running on http://localhost:${PORT}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}