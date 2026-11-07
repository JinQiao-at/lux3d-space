/**
 * Aholo Lux3D 联通性检查：不消耗生成额度，只读任务列表验证 API Key / region。
 *
 * 用法（PowerShell）：
 *   $env:AHOLO_API_KEY = "你的Key"          # 只在当前终端生效，不写入文件
 *   $env:AHOLO_REGION = "cn"               # cn=国内站(api.aholo3d.cn) / com=国际站(api.aholo.ai)
 *   node check-key.mjs
 */
import { createLux3dClient } from '@manycore/aholo-sdk-lux3d'

const apiKey = process.env.AHOLO_API_KEY
const region = process.env.AHOLO_REGION === 'com' ? 'com' : 'cn'

if (!apiKey) {
  console.error('[check] 缺少 AHOLO_API_KEY 环境变量。请在 labs.aholo3d.cn 控制台创建 API Key 后重试。')
  process.exit(2)
}

const client = createLux3dClient({ region, apiKey })

try {
  const page = await client.tasks.list()
  const items = Array.isArray(page) ? page : page?.items ?? page?.data ?? page?.list ?? []
  const regionLabel = region === 'cn' ? '国内站 api.aholo3d.cn' : '国际站 api.aholo.ai'
  console.log(`[check] OK  region=${region} (${regionLabel})  最近任务数=${Array.isArray(items) ? items.length : '未知'}`)
  if (Array.isArray(items) && items.length > 0) {
    const sample = items[0]
    console.log(`[check] 最近任务示例: ${JSON.stringify({ id: sample.id ?? sample.taskId, status: sample.status })}`)
  }
  process.exit(0)
} catch (error) {
  const info = { name: error?.name, message: error?.message, code: error?.code, status: error?.status }
  console.error('[check] 失败:', JSON.stringify(info))
  if (error?.name === 'AuthenticationError') {
    console.error('[check] 提示：Key 无效或与 region 不匹配。国内站 Key 用 AHOLO_REGION=cn，国际站用 com。')
  }
  process.exit(1)
}
