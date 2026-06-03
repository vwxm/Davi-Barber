import { cleanupTestUsers } from './helpers'

export default async function globalTeardown() {
  const removed = await cleanupTestUsers()
  console.log(`[e2e teardown] removed ${removed} test account(s)`)
}
