import assert from 'node:assert/strict';
import test from 'node:test';

import { formatFileSize, isPdfFile } from '../src/shared/lib/file';

test('파일 크기는 1MB 초과면 MB, 그 외에는 KB로 보여준다', () => {
  assert.equal(formatFileSize(512 * 1024), '512 KB');
  assert.equal(formatFileSize(1024 * 1024), '1024 KB');
  assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB');
});

test('PDF는 MIME 타입 또는 확장자로 판별한다', () => {
  assert.equal(isPdfFile({ name: 'a.bin', type: 'application/pdf' }), true);
  assert.equal(isPdfFile({ name: 'REPORT.PDF', type: '' }), true);
  assert.equal(isPdfFile({ name: 'a.png', type: 'image/png' }), false);
  assert.equal(isPdfFile({ name: 'pdf', type: '' }), false);
});
