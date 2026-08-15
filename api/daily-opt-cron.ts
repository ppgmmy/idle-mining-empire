/**
 * 每日優化觸發器（Vercel Cron）— 香港 16:00（08:00 UTC）
 *
 * 主路徑：GitHub Git Data API 原子 commit
 * 降級：workflow_dispatch → GitHub Actions
 *
 * Auth: Authorization: Bearer $CRON_SECRET
 * Env: CRON_SECRET, GH_WORKFLOW_TOKEN
 */

export const config = {
  maxDuration: 60,
}

const END_DATE = '2027-12-31'
const OWNER = 'ppgmmy'
const REPO = 'idle-mining-empire'
const BRANCH = 'master'
const ENABLED_PATH = 'src/data/enabledDailyFeatures.json'
const HISTORY_PATH = 'optimization_history.json'
const BACKLOG_PATH = 'src/data/dailyFeatureBacklog.ts'

type HistoryFile = {
  entries: Array<{
    date: string
    id: string
    title: string
    description?: string
  }>
}

type EnabledFile = {
  enabled: string[]
  updatedAt: string | null
  lastFeatureId?: string | null
  lastTitle?: string | null
}

type ApplyResult =
  | { status: 'past_end'; today: string }
  | { status: 'already_done'; today: string; id: string; title: string }
  | { status: 'exhausted'; today: string }
  | {
      status: 'apply'
      today: string
      id: string
      title: string
      description: string
      nextEnabled: EnabledFile
      nextHistory: HistoryFile
    }

function todayHktYmd(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function parseBacklog(source: string) {
  const items: Array<{ id: string; title: string; description: string }> = []
  const blockRe =
    /\{\s*id:\s*'([^']+)',\s*title:\s*'((?:\\'|[^'])*)',\s*description:\s*'((?:\\'|[^'])*)'/g
  let m
  while ((m = blockRe.exec(source)) !== null) {
    items.push({
      id: m[1],
      title: m[2].replace(/\\'/g, "'"),
      description: m[3].replace(/\\'/g, "'"),
    })
  }
  return items
}

function pickRandomByDate(
  unused: Array<{ id: string; title: string; description: string }>,
  today: string,
) {
  if (unused.length === 0) return null
  let h = 2166136261
  for (let i = 0; i < today.length; i++) {
    h ^= today.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return unused[Math.abs(h) % unused.length]!
}

function planDailyOptimization(input: {
  today: string
  backlogSrc: string
  history: HistoryFile
  enabled: EnabledFile
}): ApplyResult {
  const { today, backlogSrc, history, enabled } = input
  if (today > END_DATE) return { status: 'past_end', today }

  const doneToday = history.entries.find((e) => e.date === today)
  if (doneToday) {
    return {
      status: 'already_done',
      today,
      id: doneToday.id,
      title: doneToday.title,
    }
  }

  const backlog = parseBacklog(backlogSrc)
  const used = new Set([
    ...history.entries.map((e) => e.id),
    ...(enabled.enabled ?? []),
  ])
  const unused = backlog.filter((f) => !used.has(f.id))
  const next = pickRandomByDate(unused, today)
  if (!next) return { status: 'exhausted', today }

  return {
    status: 'apply',
    today,
    id: next.id,
    title: next.title,
    description: next.description,
    nextEnabled: {
      enabled: Array.from(new Set([...(enabled.enabled ?? []), next.id])),
      updatedAt: new Date().toISOString(),
      lastFeatureId: next.id,
      lastTitle: next.title,
    },
    nextHistory: {
      entries: [
        ...history.entries,
        {
          date: today,
          id: next.id,
          title: next.title,
          description: next.description,
        },
      ],
    },
  }
}

function isAuthorized(req: { headers: Record<string, unknown>; query: Record<string, unknown> }): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const header = req.headers.authorization
  if (header === `Bearer ${secret}`) return true
  const q = typeof req.query.secret === 'string' ? req.query.secret : ''
  return q === secret
}

async function gh(
  path: string,
  init: RequestInit & { token: string },
): Promise<Response> {
  const { token, ...rest } = init
  return fetch(`https://api.github.com${path}`, {
    ...rest,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'idle-mining-empire-daily-opt',
      ...(rest.headers ?? {}),
    },
  })
}

async function getFile(
  token: string,
  path: string,
): Promise<{ sha: string; text: string }> {
  const res = await gh(
    `/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { token },
  )
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { sha: string; content: string }
  const text = Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString(
    'utf8',
  )
  return { sha: json.sha, text }
}

async function dispatchWorkflow(token: string): Promise<void> {
  const res = await gh(
    `/repos/${OWNER}/${REPO}/actions/workflows/daily-optimization.yml/dispatches`,
    {
      token,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: BRANCH }),
    },
  )
  if (res.status !== 204 && !res.ok) {
    throw new Error(
      `workflow_dispatch failed: ${res.status} ${await res.text()}`,
    )
  }
}

async function commitBothFiles(
  token: string,
  message: string,
  files: Array<{ path: string; content: string }>,
): Promise<string> {
  const refRes = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, {
    token,
  })
  if (!refRes.ok) {
    throw new Error(`get ref failed: ${refRes.status} ${await refRes.text()}`)
  }
  const refJson = (await refRes.json()) as { object: { sha: string } }
  const headSha = refJson.object.sha

  const commitRes = await gh(`/repos/${OWNER}/${REPO}/git/commits/${headSha}`, {
    token,
  })
  if (!commitRes.ok) {
    throw new Error(
      `get commit failed: ${commitRes.status} ${await commitRes.text()}`,
    )
  }
  const commitJson = (await commitRes.json()) as { tree: { sha: string } }

  const treeRes = await gh(`/repos/${OWNER}/${REPO}/git/trees`, {
    token,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      base_tree: commitJson.tree.sha,
      tree: files.map((f) => ({
        path: f.path,
        mode: '100644',
        type: 'blob',
        content: f.content,
      })),
    }),
  })
  if (!treeRes.ok) {
    throw new Error(
      `create tree failed: ${treeRes.status} ${await treeRes.text()}`,
    )
  }
  const treeJson = (await treeRes.json()) as { sha: string }

  const newCommitRes = await gh(`/repos/${OWNER}/${REPO}/git/commits`, {
    token,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      tree: treeJson.sha,
      parents: [headSha],
      author: {
        name: 'idle-mining-empire-cron',
        email: '41898282+github-actions[bot]@users.noreply.github.com',
      },
    }),
  })
  if (!newCommitRes.ok) {
    throw new Error(
      `create commit failed: ${newCommitRes.status} ${await newCommitRes.text()}`,
    )
  }
  const newCommit = (await newCommitRes.json()) as { sha: string }

  const updateRes = await gh(
    `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`,
    {
      token,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha }),
    },
  )
  if (!updateRes.ok) {
    throw new Error(
      `update ref failed: ${updateRes.status} ${await updateRes.text()}`,
    )
  }
  return newCommit.sha
}

async function applyViaGitApi(token: string) {
  const today = todayHktYmd()
  const [enabledFile, historyFile, backlogFile] = await Promise.all([
    getFile(token, ENABLED_PATH),
    getFile(token, HISTORY_PATH),
    getFile(token, BACKLOG_PATH),
  ])

  const plan = planDailyOptimization({
    today,
    backlogSrc: backlogFile.text,
    history: JSON.parse(historyFile.text) as HistoryFile,
    enabled: JSON.parse(enabledFile.text) as EnabledFile,
  })

  if (plan.status !== 'apply') {
    return { plan, committed: false as const, sha: null as string | null }
  }

  const message = `feat(daily): enable ${plan.id} — ${plan.title}

Automated daily optimization (Vercel Cron → GitHub Git Data API).`

  const sha = await commitBothFiles(token, message, [
    {
      path: HISTORY_PATH,
      content: `${JSON.stringify(plan.nextHistory, null, 2)}\n`,
    },
    {
      path: ENABLED_PATH,
      content: `${JSON.stringify(plan.nextEnabled, null, 2)}\n`,
    },
  ])

  return { plan, committed: true as const, sha }
}

export default async function handler(
  req: {
    method?: string
    headers: Record<string, unknown>
    query: Record<string, unknown>
  },
  res: {
    status: (code: number) => { json: (body: unknown) => unknown }
  },
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  const token = process.env.GH_WORKFLOW_TOKEN
  if (!token) {
    return res.status(500).json({
      ok: false,
      error: 'GH_WORKFLOW_TOKEN not configured',
    })
  }

  try {
    if (req.query.mode === 'dispatch') {
      await dispatchWorkflow(token)
      return res.status(200).json({
        ok: true,
        mode: 'dispatch',
        today: todayHktYmd(),
        message: 'workflow_dispatch accepted',
      })
    }

    const result = await applyViaGitApi(token)
    const { plan } = result

    if (plan.status === 'already_done') {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'already_done',
        today: plan.today,
        id: plan.id,
        title: plan.title,
      })
    }
    if (plan.status === 'past_end' || plan.status === 'exhausted') {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: plan.status,
        today: plan.today,
      })
    }

    return res.status(200).json({
      ok: true,
      skipped: false,
      mode: 'git_data',
      today: plan.today,
      id: plan.id,
      title: plan.title,
      description: plan.description,
      sha: result.sha,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[daily-opt-cron]', message)
    try {
      await dispatchWorkflow(token)
      return res.status(200).json({
        ok: true,
        degraded: true,
        mode: 'dispatch',
        today: todayHktYmd(),
        warning: message,
      })
    } catch (dispatchErr) {
      return res.status(500).json({
        ok: false,
        error: message,
        dispatchError:
          dispatchErr instanceof Error
            ? dispatchErr.message
            : String(dispatchErr),
      })
    }
  }
}
