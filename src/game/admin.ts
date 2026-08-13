import { getPlayerId } from './leaderboard'
import { isTabUnlocked, type TabId } from './types'

/** 唯一管理員帳（本機 ppg 存檔） */
export const ADMIN_PLAYER_ID = '7583ab1e6d924baba9d0cfba2a216a8b'

export function isAdmin(): boolean {
  try {
    return getPlayerId() === ADMIN_PLAYER_ID
  } catch {
    return false
  }
}

/** 管理員可直接開研究／裝備分頁，唔使轉生門檻 */
export function canAccessTab(tab: TabId, rebirthCount: number): boolean {
  if (isAdmin() && (tab === 'research' || tab === 'gear')) return true
  return isTabUnlocked(tab, rebirthCount)
}
