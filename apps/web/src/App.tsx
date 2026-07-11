import { resolveScreen } from './lib/routes'
import { BuyerScreen } from './screens/BuyerScreen'
import { DemoLaunchpad } from './screens/DemoLaunchpad'
import { MarketScreen } from './screens/MarketScreen'
import { SellerScreen } from './screens/SellerScreen'

export function App() {
  const screen = resolveScreen(window.location.pathname)

  switch (screen) {
    case 'launchpad':
      return <DemoLaunchpad />
    case 'seller':
      return <SellerScreen />
    case 'market':
      return <MarketScreen />
    case 'buyer':
      return <BuyerScreen />
    default:
      return (
        <main className="page room">
          <p className="brand-name">Fleek Auction House</p>
          <h1>Room not found</h1>
          <p>
            <a href="/demo">Return to the presenter launchpad</a>
          </p>
        </main>
      )
  }
}
