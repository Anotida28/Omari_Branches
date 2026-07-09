import { Router } from 'express';

import {
  getSmsLog,
  getSmsPreview,
  getSmsImpact,
  retrySms,
} from '../controllers/subscription-sms.controller';

const router = Router();

router.get('/log',      getSmsLog);
router.get('/preview',  getSmsPreview);
router.get('/impact',   getSmsImpact);
router.post('/retry',   retrySms);

export default router;
