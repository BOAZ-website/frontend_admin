import assert from 'node:assert/strict';
import test from 'node:test';

import { formatFileSize } from '../src/shared/lib/file';

test('파일 크기는 1MB 초과면 MB, 그 외에는 KB로 보여준다', () => {
  assert.equal(formatFileSize(512 * 1024), '512 KB');
  assert.equal(formatFileSize(1024 * 1024), '1024 KB');
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
});
