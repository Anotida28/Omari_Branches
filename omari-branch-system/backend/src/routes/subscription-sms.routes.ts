import { Router } from 'express';

import {
  getSmsLog,
  getSmsPreview,
  getSmsImpact,
} from '../controllers/subscription-sms.controller';

const router = Router();

router.get('/log',     getSmsLog);
router.get('/preview', getSmsPreview);
router.get('/impact',  getSmsImpact);

export default router;
