import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEgpRecords, usagePointRecords } from './egp.js';
import { parseUsagePointContentSeedFile } from './usage-point-content-seed.js';

const readAsset = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(join(process.cwd(), 'assets', name), 'utf8'));

describe('assets/grammar-usage-point-content.json', () => {
  it('has content for exactly the EGP records that become usage points', async () => {
    const content = parseUsagePointContentSeedFile(
      await readAsset('grammar-usage-point-content.json'),
    );
    const useIndexes = usagePointRecords(
      parseEgpRecords(await readAsset('egp.json')),
    )
      .map((record) => String(record.index))
      .sort();

    expect(Object.keys(content).sort()).toEqual(useIndexes);
  });
});
