export type DemoScreen = 'launchpad' | 'seller' | 'market' | 'buyer' | 'not-found'

const screens: Readonly<Record<string, DemoScreen>> = {
  '/': 'launchpad',
  '/demo': 'launchpad',
  '/seller': 'seller',
  '/market': 'market',
  '/buyer': 'buyer',
}

export function resolveScreen(pathname: string): DemoScreen {
  return screens[pathname] ?? 'not-found'
}
