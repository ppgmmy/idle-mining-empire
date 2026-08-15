import { createInitialState, facilityCost, facilityLevel, FACILITIES } from './src/game/state'
import { tick } from './src/game/actions'
import { bn } from './src/game/bigNumber'

let state = createInitialState()
state = {
  ...state,
  ore: bn(1200),
  miners: 3,
  facilities: { pulse: 2, conveyor: 0, blast: 0, foreman: 0 },
  researchLevels: { 'auto-facility': 1 },
  automations: state.automations.map((a) =>
    a.kind === 'autoFacility' ? { ...a, enabled: true } : a,
  ),
}
for (const d of FACILITIES) {
  const unlocked = d.unlocked(state)
  const lv = facilityLevel(state, d.id)
  const c = facilityCost(d, lv)
  console.log(d.id, unlocked, 'lv', lv, 'cost', c.toString(), 'afford', state.ore.gte(c))
}
state = tick(state, 0.2)
console.log('after facilities', state.facilities, 'ore', state.ore.toString())
