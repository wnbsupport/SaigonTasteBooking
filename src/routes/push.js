'use strict';
const express = require('express');
const { requireAuth } = require('../lib/auth');
const push = require('../lib/push');
const store = require('../lib/store');
const { db } = require('../db');

const router = express.Router();
router.use(requireAuth);

router.get('/key', async (req, res) => {
  const k = await push.vapid();
  const devices = (await db()('push_subscriptions').where({ user_id: req.user.id }).count({ n: '*' }))[0].n;
  res.json({ publicKey: k.publicKey, devices: Number(devices) });
});
router.post('/subscribe', async (req, res) => {
  const ok = await push.saveSubscription(req.user.id, req.body.subscription, req.get('user-agent'));
  if (!ok) return res.status(400).json({ error: 'subscription' });
  if (req.body.fresh) await store.audit(req, 'push_on', String(req.get('user-agent') || '').slice(0, 120));
  res.json({ ok: true });
});
router.post('/unsubscribe', async (req, res) => {
  await push.removeSubscription(req.user.id, req.body.endpoint);
  if (req.body.byUser) await store.audit(req, 'push_off', '');
  res.json({ ok: true });
});
router.post('/test', async (req, res) => {
  res.json(await push.sendTest(req.user.id, req.user.lang, req.body.endpoint));
});

module.exports = router;
