import { Router } from 'express';

import { getSmsLog, getSmsPreview } from '../controllers/subscription-sms.controller';

const router = Router();

router.get('/log',     getSmsLog);
router.get('/preview', getSmsPreview);

export default router;
