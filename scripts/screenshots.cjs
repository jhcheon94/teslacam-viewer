// Public screenshots use synthetic video and fictional events only.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, 'docs', 'images');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1080 }, colorScheme: 'light' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // All test content stays local. External services are deliberately blocked.
    await page.route('https://**/*', route => route.abort());
    await page.goto(pathToFileURL(path.join(root, 'teslacam-viewer.html')).href);
    await page.evaluate(() => { document.querySelector('#net').checked = false; });
    const shot = name => page.screenshot({ path: path.join(output, name + '.png'), animations: 'disabled' });
    await shot('home');
    await page.getByRole('button', { name: '단축키 안내', exact: true }).first().click();
    assert.equal(await page.getByRole('dialog').count(), 1);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'keysClose');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'help');
    const chooserPromise = page.waitForEvent('filechooser');
    await page.locator('#welcome-open').click();
    const chooser = await chooserPromise;
    assert.equal(chooser.isMultiple(), true);
    await page.evaluate(() => clearFolderHelp());
    await page.evaluate(async () => {
      const cv = document.createElement('canvas'); cv.width = 960; cv.height = 540;
      const ctx = cv.getContext('2d');
      function frame(t) {
        const sky = ctx.createLinearGradient(0, 0, 0, 330);
        sky.addColorStop(0, '#adc6cf'); sky.addColorStop(1, '#e3e7dc');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, 960, 540);
        ctx.fillStyle = '#f3e9c7'; ctx.beginPath(); ctx.arc(765, 100, 37, 0, Math.PI * 2); ctx.fill();
        for (const [x, y, h] of [[0, 220, 140], [240, 200, 100], [540, 180, 120], [800, 230, 110]]) {
          ctx.fillStyle = '#849d8f'; ctx.beginPath(); ctx.moveTo(x - 240, 325);
          ctx.lineTo(x, y - h / 2); ctx.lineTo(x + 260, 325); ctx.fill();
        }
        ctx.fillStyle = '#8f9f7b'; ctx.fillRect(0, 310, 960, 230);
        ctx.fillStyle = '#4e595a'; ctx.beginPath(); ctx.moveTo(430, 310);
        ctx.lineTo(530, 310); ctx.lineTo(880, 540); ctx.lineTo(80, 540); ctx.fill();
        ctx.strokeStyle = '#e6e4ce'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(422, 315); ctx.lineTo(65, 540); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(538, 315); ctx.lineTo(895, 540); ctx.stroke();
        ctx.setLineDash([27, 24]); ctx.lineDashOffset = -t * 20;
        ctx.beginPath(); ctx.moveTo(480, 320); ctx.lineTo(480, 540); ctx.stroke(); ctx.setLineDash([]);
        for (let i = 0; i < 5; i++) {
          const x = 45 + i * 65, y = 345 + i * 10;
          ctx.fillStyle = '#435c4d'; ctx.beginPath(); ctx.moveTo(x, y - 90);
          ctx.lineTo(x - 30, y); ctx.lineTo(x + 30, y); ctx.fill();
        }
        ctx.fillStyle = '#182e36bb'; ctx.fillRect(22, 485, 296, 32);
        ctx.fillStyle = '#fff'; ctx.font = '16px sans-serif';
        ctx.fillText('DEMO · SYNTHETIC FOOTAGE', 34, 507);
      }
      frame(0);
      const stream = cv.captureStream(20);
      const mime = ['video/mp4;codecs=avc1.42001E', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
      if (!mime) throw new Error('This test requires Chromium with MP4 MediaRecorder support.');
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks = []; recorder.ondataavailable = e => chunks.push(e.data);
      const stopped = new Promise(resolve => recorder.onstop = resolve);
      recorder.start();
      const start = performance.now();
      await new Promise(resolve => {
        function draw() { const t = (performance.now() - start) / 1000; frame(t);
          if (t < 3) requestAnimationFrame(draw); else resolve(); }
        draw();
      });
      recorder.stop(); await stopped; stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: mime });
      const cams = ['front', 'left_repeater', 'right_repeater', 'back', 'left_pillar', 'right_pillar'];
      const entries = [];
      const clips = [
        ['08-10', 'SavedClips', 'user_interaction_honk', 37.55, 126.98],
        ['08-20', 'SavedClips', 'user_interaction_dashcam_panel_save', 37.553, 126.984],
        ['08-30', 'SentryClips', 'sentry_aware_object_detection', 37.557, 126.988],
      ];
      for (const [time, kind, reason, la, lo] of clips) {
        const stamp = '2026-09-01_' + time + '-00';
        const base = 'TeslaCam/' + kind + '/' + stamp + '/';
        for (let minute = 0; minute < 10; minute++) {
          const st = '2026-09-01_08-' + String(Number(time.slice(3)) - 9 + minute).padStart(2, '0') + '-00';
          for (const cam of cams) entries.push({ path: base + st + '-' + cam + '.mp4',
            file: new File([blob], st + '-' + cam + '.mp4') });
        }
        entries.push({ path: base + 'event.json', file: new File([JSON.stringify({
          timestamp: '2026-09-01T' + time.replace('-', ':') + ':01',
          reason, est_lat: la, est_lon: lo, city: '가상 예시 위치'
        })], 'event.json') });
      }
      await index(entries);
      select(CLIPS.find(c => c.event.reason === 'user_interaction_honk'));
    });
    await page.waitForFunction(() => master?.readyState >= 2);
    assert.equal(await page.locator('video').count(), 6);
    assert.equal(await page.locator('.journey-details .chip').count(), 0);
    await page.evaluate(() => seek(1));
    await shot('player');
    await page.locator('#help').click();
    await shot('shortcuts');
    await page.keyboard.press('Escape');
    await page.locator('.journey-details summary').click();
    await page.waitForFunction(() => document.querySelectorAll('.journey-details .chip').length === 10);
    await page.evaluate(() => { zoom('right_pillar'); goToMoment(cur, cur.segments[2].at + 1000); });
    await page.waitForFunction(() => master?.readyState >= 2 && segIndex(cur) === 2);
    assert.equal(await page.evaluate(() => zoomed), 'right_pillar');
    await page.waitForFunction(() => vids.every(v => v.readyState >= 2));
    await page.evaluate(async () => {
      const saved = [];
      saveBlob = (blob, name) => saved.push({ size: blob.size, name });
      await exportClips([{ cam: 'right_pillar', s: 0, e: 1 }], 'QA');
      if (saved.length !== 1 || saved[0].size === 0) throw new Error('Export failed');
      const v = master, originalPlay = v.play;
      v.play = () => Promise.reject(new Error('Simulated playback failure'));
      recording = { cancel: false };
      let failed = false;
      try { await recordOne(v, 'front', 0, 1, pickType()); } catch { failed = true; }
      finally { v.play = originalPlay; recording = null; }
      if (!failed || !v.paused) throw new Error('Failed export did not clean up');
      setViewMode('map');
    });
    await page.waitForFunction(() => document.querySelectorAll('.map-route line').length === 2);
    await shot('map');
    assert.ok((await page.locator('.mppin text:not(.n)').allTextContents()).every(s => s.includes('2026.09.01')));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => setViewMode('list'));
    await page.setViewportSize({ width: 1440, height: 1080 });
    await shot('dark');
    assert.deepEqual(errors, []);
    console.log('PASS: shortcuts, folder picker, six cameras, seek, export/error cleanup, map dates/routes, mobile.');
    console.log('Screenshots: ' + output);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
