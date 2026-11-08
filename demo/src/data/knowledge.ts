/**
 * 知识档案（ECO 信息组织的数据层）。
 *
 * - 前 11 条 id / 字段严格对齐 server/app/seed_knowledge.json，保证前后端契约一致；
 * - T-015 起新增 6 条 lore 条目（上一任屋主 / ECO 三符号 / 暗门来历 / 炉膛刻字 / 三声钟响 / A16-024），
 *   字段 schema 与 seed 完全一致（id/zoneId/objectId/cameraId/title/topics/content/sources/confidence）；
 * - 额外补充 relatedObjectIds / spoilerLevel 两个前端演示字段（seed 未提供，可选）；
 * - 检索与空间 ID 的映射完全由本文件的数据字段驱动，UI 不硬编码。
 */
import type { KnowledgeEntry, ZoneId } from '../game/types.ts'

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'book_A16_023',
    zoneId: 'zone_study',
    objectId: 'obj_study_bookshelf',
    cameraId: 'cam_study_bookshelf',
    title: '《符号学与中世纪密码》',
    topics: ['符号学', '中世纪', '密码'],
    content:
      '一本夹着半页手稿的旧书。书脊编号 A16-023，扉页写着：符号先于语言，顺序先于意义。作者认为中世纪的石匠把机关顺序藏进了三段式浮雕里。',
    sources: ['本项目设定集 · 藏书卷', '参考：Eco, U. 符号学理论（概念）'],
    confidence: 'verified',
    relatedObjectIds: ['obj_study_bookshelf', 'obj_basement_mural'],
    spoilerLevel: 1,
  },
  {
    id: 'kb_study_room',
    zoneId: 'zone_study',
    objectId: null,
    cameraId: 'cam_study_desk',
    title: '夜雨书房的空间结构',
    topics: ['建筑', '空间', '书房'],
    content:
      '书房呈东西向长方形：西墙是壁炉，北墙整面书架，东墙挂一幅油画，南墙立着一面落地镜。地板靠壁炉一侧有轻微空鼓声，疑似下方藏有空间。',
    sources: ['本项目设定集 · 空间卷'],
    confidence: 'verified',
    relatedObjectIds: ['obj_study_fireplace', 'obj_study_floor_door'],
    spoilerLevel: 1,
  },
  {
    id: 'kb_lantern_origin',
    zoneId: 'zone_study',
    objectId: 'obj_study_bookshelf',
    cameraId: 'cam_study_bookshelf',
    title: '提灯的来历',
    topics: ['提灯', '光', '机关'],
    content:
      '黄铜提灯原本属于上一任屋主，灯座刻着同一组三符号。提灯亮起时，某些只在黑暗中隐形的墨迹才会显形；地下室因此常年无光。',
    sources: ['本项目设定集 · 器物卷'],
    confidence: 'inferred',
    relatedObjectIds: ['obj_study_bookshelf', 'obj_study_floor_door'],
    spoilerLevel: 1,
  },
  {
    id: 'kb_painting',
    zoneId: 'zone_study',
    objectId: 'obj_study_painting',
    cameraId: 'cam_study_painting',
    title: '黄昏书房油画',
    topics: ['油画', '艺术史'],
    content:
      '画面是一间与这间书房几乎相同的房间，但画中的书架向左侧滑开，露出一条向下的阶梯。与实景不同的是，画里没有镜子。',
    sources: ['本项目设定集 · 藏品卷'],
    confidence: 'verified',
    relatedObjectIds: ['obj_study_painting', 'obj_study_bookshelf'],
    spoilerLevel: 0,
  },
  {
    id: 'kb_mirror',
    zoneId: 'zone_study',
    objectId: 'obj_study_mirror',
    cameraId: 'cam_study_mirror',
    title: '落地镜上的雾痕',
    topics: ['镜子', '线索', '超自然'],
    content:
      '镜面蒙着一层始终擦不掉的雾。雨天时雾里会多出一行字：三声钟响后，镜子记得来路。有人相信，镜子记的是屋子前一位主人的动线。',
    sources: ['本项目设定集 · 灵异卷'],
    confidence: 'inferred',
    relatedObjectIds: ['obj_study_mirror'],
    spoilerLevel: 1,
  },
  {
    id: 'kb_shower',
    zoneId: 'zone_basement',
    objectId: 'obj_basement_shower',
    cameraId: 'cam_basement_shower',
    title: '淋浴间玻璃门后的暗门',
    topics: ['暗门', '机关', '地下室'],
    content:
      '淋浴间的磨砂玻璃门常年被水垢覆盖。提灯贴近时，能看见玻璃后另有一道石门轮廓，门缝里嵌着三个可旋转的铜盘。',
    sources: ['本项目设定集 · 机关卷'],
    confidence: 'verified',
    relatedObjectIds: ['obj_basement_shower', 'obj_basement_dial_1', 'obj_basement_secret_door'],
    spoilerLevel: 2,
  },
  {
    id: 'kb_mural_symbols',
    zoneId: 'zone_basement',
    objectId: 'obj_basement_mural',
    cameraId: 'cam_basement_mural',
    title: '石壁浮雕上的三符号',
    topics: ['符号学', '浮雕', '线索'],
    content:
      '浮雕自上而下排着三个符号：三角、圆环、方框。符号旁刻着三个点、一个点、两个点。按手稿的说法，点数是每个符号的序号。',
    sources: ['本项目设定集 · 机关卷', '参考：中世纪石匠记号（概念）'],
    confidence: 'verified',
    relatedObjectIds: ['obj_basement_mural', 'obj_basement_dial_1', 'obj_basement_dial_2', 'obj_basement_dial_3'],
    spoilerLevel: 2,
  },
  {
    id: 'kb_basin_inscription',
    zoneId: 'zone_basement',
    objectId: 'obj_basement_basin',
    cameraId: 'cam_basement_basin',
    title: '洗手台底部的刻文',
    topics: ['铭文', '校验'],
    content:
      '铜制水管下方有一行反向刻字：先三后一，最后二；误者，门不复开。刻字旁边有三个铜盘的安装孔，间距与暗门上的铜盘一致。',
    sources: ['本项目设定集 · 机关卷'],
    confidence: 'verified',
    relatedObjectIds: ['obj_basement_basin', 'obj_basement_dial_1', 'obj_basement_dial_2', 'obj_basement_dial_3'],
    spoilerLevel: 2,
  },
  {
    id: 'kb_secret_door',
    zoneId: 'zone_basement',
    objectId: 'obj_basement_secret_door',
    cameraId: 'cam_basement_shower',
    title: '暗门的构造',
    topics: ['机关', '建筑'],
    content:
      '暗门是配重式的：三个铜盘按顺序同时对齐后，门轴才会脱开。设计中特意留了一次错序不锁死的余量，方便后来者重试。',
    sources: ['本项目设定集 · 机关卷'],
    confidence: 'inferred',
    relatedObjectIds: ['obj_basement_secret_door'],
    spoilerLevel: 2,
  },
  {
    id: 'kb_chamber_altar',
    zoneId: 'zone_chamber',
    objectId: 'obj_chamber_pedestal',
    cameraId: 'cam_chamber_pedestal',
    title: '密室石台上的手稿',
    topics: ['结局', '器物'],
    content:
      '石台上放着一本没有书名的册子，最后一页只写了一句：屋子的下一层，留给愿意继续往下走的人。册子背面烙着 A16-024。',
    sources: ['本项目设定集 · 结局卷'],
    confidence: 'verified',
    relatedObjectIds: ['obj_chamber_pedestal'],
    spoilerLevel: 3,
  },
  {
    id: 'kb_tapestry',
    zoneId: 'zone_chamber',
    objectId: 'obj_chamber_tapestry',
    cameraId: 'cam_chamber_pedestal',
    title: '密室挂毯上的地图',
    topics: ['世界观', '伏笔'],
    content:
      '挂毯织着一张陌生城市的鸟瞰图，中央标着与书房相同的镜像位置。图例里写着：下一站，镜厅。',
    sources: ['本项目设定集 · 世界观卷'],
    confidence: 'uncertain',
    relatedObjectIds: ['obj_chamber_tapestry'],
    spoilerLevel: 3,
  },
  {
    id: 'kb_previous_owner',
    zoneId: 'zone_study',
    objectId: null,
    cameraId: 'cam_study_bookshelf',
    title: '上一任屋主：一个没有留下名字的人',
    topics: ['屋主', '年代', '守灯人'],
    content:
      '书房里所有“不合常理”的细节都指向同一个人：被撕走前页的日记、书桌角反复刻出的 A16、被摸亮的铜盘边缘。他点亮过提灯，试过机关，也一定走到过某个后来者还没到的地方。他没有留下名字，只留下了一句“先三后一”。设定集里称他为“守灯人”，但没有任何一页写过他的结局。',
    sources: ['本项目设定集 · 人物卷', '本项目设定集 · 年代考'],
    confidence: 'inferred',
    relatedObjectIds: ['obj_study_desk', 'obj_study_bookshelf', 'obj_basement_secret_door'],
    spoilerLevel: 2,
  },
  {
    id: 'kb_eco_three_symbols',
    zoneId: 'zone_basement',
    objectId: 'obj_basement_mural',
    cameraId: 'cam_basement_mural',
    title: 'ECO 三符号：秩序、循环与边界',
    topics: ['符号学', 'ECO', '机关'],
    content:
      '在项目的信息组织法里，三个符号并非装饰：三角代表“秩序”，圆环代表“循环”，方框代表“边界”。石匠把它们刻进三段式浮雕，也把数字序号藏进点阵：三点、一点、两点。一个故事要能被走进去，至少需要秩序、循环和边界——这是设定集对“叙事空间”的工作定义，而非公认的符号学结论。',
    sources: ['本项目设定集 · 符号卷', '本项目设定集 · 方法论页（ECO 工作定义）'],
    confidence: 'inferred',
    relatedObjectIds: ['obj_basement_mural', 'obj_basement_dial_1', 'obj_basement_dial_2', 'obj_basement_dial_3'],
    spoilerLevel: 2,
  },
  {
    id: 'kb_secret_door_origin',
    zoneId: 'zone_basement',
    objectId: 'obj_basement_secret_door',
    cameraId: 'cam_basement_shower',
    title: '暗门的来历：为难后来者的配重石门',
    topics: ['暗门', '建筑', '工匠'],
    content:
      '配重式石门比普通暗门更难造，也更难守。它挡住的不是盗贼，而是“顺序不对的后来者”——门轴里留了一次错序不锁死的余量，说明造门的人相信：有人会回来重试，而且不止一次。淋浴间的水垢、被摸亮的铜盘、定期擦拭的安装孔，都说明这扇门在很长一段时间里被人反复接近、反复失败。',
    sources: ['本项目设定集 · 机关卷', '本项目设定集 · 工匠手记（片段）'],
    confidence: 'inferred',
    relatedObjectIds: ['obj_basement_secret_door', 'obj_basement_shower', 'obj_basement_basin'],
    spoilerLevel: 2,
  },
  {
    id: 'kb_hearth_inscription',
    zoneId: 'zone_study',
    objectId: 'obj_study_fireplace',
    cameraId: 'cam_study_fireplace',
    title: '炉膛刻字：灯亮起时，向低处看',
    topics: ['壁炉', '刻字', '线索'],
    content:
      '炉膛内壁的刻字被烟熏得很深，只有在火光斜照时才读得出来：“灯亮起时，向低处看。”这句话不是给所有人看的——没有灯的人，低头也只看得到黑。炉火正对的那面墙根，地板的拼缝比别处平，木色也新一点。它一直在那里，只是从来没有人弯腰。',
    sources: ['本项目设定集 · 空间卷'],
    confidence: 'verified',
    relatedObjectIds: ['obj_study_fireplace', 'obj_study_floor_door'],
    spoilerLevel: 1,
  },
  {
    id: 'kb_three_bells',
    zoneId: 'zone_study',
    objectId: 'obj_study_mirror',
    cameraId: 'cam_study_desk',
    title: '三声钟响与镜中的第二秒',
    topics: ['镜子', '时钟', '超自然'],
    content:
      '日记写“三声钟响后，镜子记得来路”，而书房里没有钟。镜子起雾时，倒影会比你多站一秒才转身；第三声钟响之后，雾里会浮出那行字。项目设定集没有解释钟声的来源，只注明：镜子记的是屋子前一位主人的动线，而不是照镜子的人的。',
    sources: ['本项目设定集 · 灵异卷', '本项目设定集 · 时间线草稿（未公开）'],
    confidence: 'uncertain',
    relatedObjectIds: ['obj_study_mirror', 'obj_study_diary'],
    spoilerLevel: 2,
  },
  {
    id: 'kb_manuscript_a16_024',
    zoneId: 'zone_chamber',
    objectId: 'obj_chamber_pedestal',
    cameraId: 'cam_chamber_pedestal',
    title: 'A16-024：没有书名的册子',
    topics: ['手稿', '编号', '下一章'],
    content:
      '册子没有书名、没有作者、没有目录，最后一页只有一句话：“屋子的下一层，留给愿意继续往下走的人。”背面烙着 A16-024。前面的页被撕走了，纸边整齐。编号承接书桌上刻着的 A16，也承接书架上那本 A16-023——它们不是库存编号，是同一份档案的页码。挂毯图例里的“下一站，镜厅”，很可能就是 A16-025。',
    sources: ['本项目设定集 · 结局卷', '本项目设定集 · 下一章大纲（未公开）'],
    confidence: 'inferred',
    relatedObjectIds: ['obj_chamber_pedestal', 'obj_chamber_tapestry'],
    spoilerLevel: 3,
  },
  {
    id: 'kb_basin_compartment',
    zoneId: 'zone_basement',
    objectId: 'obj_basement_basin',
    cameraId: 'cam_basement_basin',
    title: '洗手台暗格：钥匙不给门',
    topics: ['洗手台', '黄铜钥匙', '暗格', '支线'],
    content:
      '铜管下方第三个安装孔并非装饰：黄铜钥匙（书架暗格绒布夹层所得，钥匙柄刻方框符号）可以插入并转过半圈，弹开洗手台基座侧面的薄板。暗格是这间地下室唯一干燥的角落，里面固定着一张对折的纸——“钥匙不给门。给愿意多按一次的人。”纸背面画着三个安装孔，第三个旁有一个对勾。它与主线机关（3→1→2）互不影响，是留给“愿意多按一次的人”的支线。',
    sources: ['游戏内支线：use_item_on（黄铜钥匙×洗手台）', '本项目设定集 · 上一任屋主卷'],
    confidence: 'verified',
    relatedObjectIds: ['obj_basement_basin', 'obj_study_bookshelf'],
    spoilerLevel: 2,
  },
]

export const KNOWLEDGE_BY_ID: Record<string, KnowledgeEntry> = Object.fromEntries(
  KNOWLEDGE_BASE.map((entry) => [entry.id, entry]),
)

export interface KnowledgeFilters {
  topic?: string
  zoneId?: ZoneId
  maxSpoiler?: number
}

/** 归一化后的查询词（支持中文子串、英文大小写不敏感）。 */
function normalize(text: string): string {
  return text.trim().toLowerCase()
}

/**
 * 关键词 + 主题过滤检索。
 * 计分：标题命中 6 分，topic 命中 4 分，id 命中 3 分，正文命中 1 分；多关键词需全部命中（AND）。
 */
export function searchKnowledge(
  query: string,
  filters: KnowledgeFilters = {},
  entries: KnowledgeEntry[] = KNOWLEDGE_BASE,
): KnowledgeEntry[] {
  const tokens = normalize(query)
    .split(/[\s,，。;；、]+/)
    .filter((token) => token.length > 0)

  const scored: { entry: KnowledgeEntry; score: number }[] = []
  for (const entry of entries) {
    if (filters.zoneId && entry.zoneId !== filters.zoneId) continue
    if (filters.topic && !entry.topics.includes(filters.topic)) continue
    if (filters.maxSpoiler !== undefined && (entry.spoilerLevel ?? 0) > filters.maxSpoiler) continue

    const title = normalize(entry.title)
    const content = normalize(entry.content)
    const topics = entry.topics.map(normalize)
    const id = normalize(entry.id)

    let matchedAll = true
    let score = 0
    for (const token of tokens) {
      let tokenScore = 0
      if (title.includes(token)) tokenScore += 6
      if (topics.some((topic) => topic.includes(token) || token.includes(topic))) tokenScore += 4
      if (id.includes(token)) tokenScore += 3
      if (content.includes(token)) tokenScore += 1
      if (tokenScore === 0) {
        matchedAll = false
        break
      }
      score += tokenScore
    }
    if (matchedAll) scored.push({ entry, score })
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.entry.id.localeCompare(b.entry.id)
  })
  return scored.map((item) => item.entry)
}

/** 全部主题标签（供档案面板的 topic 过滤 chips 使用）。 */
export function listTopics(entries: KnowledgeEntry[] = KNOWLEDGE_BASE): string[] {
  const set = new Set<string>()
  for (const entry of entries) for (const topic of entry.topics) set.add(topic)
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
}

/** 根据 objectId 找到相关条目（用于点击 3D 对象时反向查档案）。 */
export function knowledgeForObject(objectId: string, entries: KnowledgeEntry[] = KNOWLEDGE_BASE): KnowledgeEntry[] {
  return entries.filter(
    (entry) => entry.objectId === objectId || (entry.relatedObjectIds ?? []).includes(objectId),
  )
}

/** 档案结果对应的可高亮对象（objectId 允许为 null 时回退 relatedObjectIds）。 */
export function focusTargetOf(entry: KnowledgeEntry): { cameraId: string; objectId: string | null } {
  const objectId = entry.objectId ?? (entry.relatedObjectIds && entry.relatedObjectIds.length > 0 ? entry.relatedObjectIds[0] : null)
  return { cameraId: entry.cameraId, objectId }
}
