import { createApp } from './app.js'

const port = Number.parseInt(process.env.PORT ?? '3001', 10)
const { httpServer } = createApp()

httpServer.listen(port, '127.0.0.1', () => {
  console.log(`Fleek Auction server listening on http://127.0.0.1:${port}`)
})
