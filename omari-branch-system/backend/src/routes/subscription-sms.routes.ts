import { Router } from 'express';

import {
  getSmsLog,
  getSmsPreview,
  getSmsImpact,
  getSmsConfig,
  updateSmsConfig,
  retrySms,
} from '../controllers/subscription-sms.controller';

const router = Router();

router.get('/log',      getSmsLog);
router.get('/preview',  getSmsPreview);
router.get('/impact',   getSmsImpact);
router.get('/config',   getSmsConfig);
router.put('/config',   updateSmsConfig);
router.post('/retry',   retrySms);

export default router;
