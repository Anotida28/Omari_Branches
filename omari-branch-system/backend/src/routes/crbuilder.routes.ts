import { Router } from 'express';
import {
  getAiResponse,
  getFilteredData,
  getIndividualRecords,
  getVisaCombinedStats,
  getVisaExportSelectedCustomers,
  getVisaMerchantDetails,
  getVisaMerchantDetailsExport,
  getVisaMerchants,
} from '../controllers/crbuilder.controller';

const router = Router();

router.post('/filtered-data',                  getFilteredData);
router.post('/visa-merchants',                 getVisaMerchants);
router.post('/visa-combined-stats',            getVisaCombinedStats);
router.post('/visa-merchant-details',          getVisaMerchantDetails);
router.post('/visa-merchant-details-export',   getVisaMerchantDetailsExport);
router.post('/visa-export-selected-customers', getVisaExportSelectedCustomers);
router.post('/individual-records',             getIndividualRecords);
router.post('/ai',                             getAiResponse);

export default router;
