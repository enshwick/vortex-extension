import { assert, property, string, stringMatching } from 'fast-check';
import { describe, expect, it } from 'vitest';

import { PackManifest } from '../pack-manifest';

describe('PackManifest', () => {
  it('reads the id a manifest declares, whatever else it holds', () => {
    const id = stringMatching(/^[a-z][a-z0-9-]{0,20}\.[a-z][a-z0-9-]{0,20}$/u);

    assert(
      property(id, (text) => {
        const manifest = `#:schema ./pack.schema.json\nid = "${text}"\nversion = "0.1.0"\n\n[[setting]]\nid = "not.this"\n`;

        expect(PackManifest.idOf(manifest)?.value).toBe(text);
      }),
    );
  });

  it('reads no id from any text without throwing', () => {
    assert(
      property(string(), (text) => {
        expect(PackManifest.idOf(`${text}\nid = 1`)).toBeUndefined();
      }),
    );
  });

  it('reads no id Windows refuses as a folder name', () => {
    expect(PackManifest.idOf('id = "nul.greeter"')).toBeUndefined();
    expect(PackManifest.idOf('id = "you.greeter"')?.value).toBe('you.greeter');
  });

  it('reads no id from a file that is not there', async () => {
    await expect(PackManifest.idAt('nowhere/pack.toml')).resolves.toBeUndefined();
  });
});
