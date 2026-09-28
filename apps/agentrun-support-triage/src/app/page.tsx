import { Studio } from '@/components/studio/studio'
import { seedTickets } from '@/server/runner'

export default function Home() {
  return <Studio seeds={seedTickets()} />
}
