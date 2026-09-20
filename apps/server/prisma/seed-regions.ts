import { PrismaClient } from './prisma-client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface Province { code: string; name: string; }
interface City { code: string; name: string; provinceCode: string; }
interface Area { code: string; name: string; provinceCode: string; cityCode: string; }

function load<T>(name: string): T[] {
  const fp = path.join(__dirname, 'region-data', name);
  return JSON.parse(fs.readFileSync(fp, 'utf8')) as T[];
}

/**
 * 行政区划种子（国标 GB/T 2260，来源 modood/Administrative-divisions-of-China）。
 *
 * regionPath 采用「国标 code 链」而非 cuid 链：
 *   - 省 level1:  regionPath = "11"
 *   - 市 level2:  regionPath = "11/1101"
 *   - 区 level3:  regionPath = "11/1101/110101"
 * 这样代理辖区作用域只需 `regionPath startsWith :agentRegionPath` 即可前缀匹配
 * （绑定省级 → 匹配全省；绑定区级 → 仅该区），无需递归 join，且可读、稳定、幂等。
 */
async function main() {
  const provinces = load<Province>('provinces.json');
  const cities = load<City>('cities.json');
  const areas = load<Area>('areas.json');
  console.log(`[regions] 加载：省 ${provinces.length} / 市 ${cities.length} / 区(县) ${areas.length}`);

  const provMap: Record<string, string> = {};
  const cityMap: Record<string, string> = {};

  // 1) 省 level=1
  for (const p of provinces) {
    const r = await prisma.region.upsert({
      where: { code: p.code },
      update: { name: p.name, level: 1, regionPath: p.code },
      create: { code: p.code, name: p.name, level: 1, regionPath: p.code },
    });
    provMap[p.code] = r.id;
  }
  console.log(`[regions] 省写入完成 ${provinces.length}`);

  // 2) 市 level=2
  for (const c of cities) {
    const parentId = provMap[c.provinceCode];
    if (!parentId) {
      console.warn(`[regions] 跳过市 ${c.code}（缺省 ${c.provinceCode}）`);
      continue;
    }
    const r = await prisma.region.upsert({
      where: { code: c.code },
      update: { name: c.name, level: 2, parentId, regionPath: `${c.provinceCode}/${c.code}` },
      create: { code: c.code, name: c.name, level: 2, parentId, regionPath: `${c.provinceCode}/${c.code}` },
    });
    cityMap[c.code] = r.id;
  }
  console.log(`[regions] 市写入完成 ${Object.keys(cityMap).length}`);

  // 3) 区(县) level=3
  let done = 0;
  for (const a of areas) {
    const parentId = cityMap[a.cityCode];
    if (!parentId) {
      console.warn(`[regions] 跳过区 ${a.code}（缺市 ${a.cityCode}）`);
      continue;
    }
    await prisma.region.upsert({
      where: { code: a.code },
      update: { name: a.name, level: 3, parentId, regionPath: `${a.provinceCode}/${a.cityCode}/${a.code}` },
      create: { code: a.code, name: a.name, level: 3, parentId, regionPath: `${a.provinceCode}/${a.cityCode}/${a.code}` },
    });
    done++;
    if (done % 500 === 0) console.log(`[regions] 已写入区(县) ${done}/${areas.length}`);
  }
  console.log(`[regions] 区(县)写入完成 ${done}`);

  const total = await prisma.region.count();
  console.log(`✅ Region 种子完成，总记录 ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
