import { Router } from 'express';

import { getAnalytics, getResellerDetail } from '../controllers/flocash-analytics.controller';

const router = Router();

router.get('/analytics',                    getAnalytics);
router.get('/reseller/:accountId/detail',   getResellerDetail);

export default router;
