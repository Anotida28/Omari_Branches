import type { NextFunction, Request, Response } from 'express';
import {
  proxyAi,
  proxyFilteredData,
  proxyIndividualRecords,
  proxyVisaCombinedStats,
  proxyVisaExportSelectedCustomers,
  proxyVisaMerchantDetails,
  proxyVisaMerchantDetailsExport,
  proxyVisaMerchants,
} from '../services/crbuilder-proxy.service';

function handle(fn: (body: unknown) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await fn(req.body);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };
}

export const getFilteredData            = handle(proxyFilteredData);
export const getVisaMerchants           = handle(proxyVisaMerchants);
export const getVisaCombinedStats       = handle(proxyVisaCombinedStats);
export const getVisaMerchantDetails     = handle(proxyVisaMerchantDetails);
export const getVisaMerchantDetailsExport = handle(proxyVisaMerchantDetailsExport);
export const getVisaExportSelectedCustomers = handle(proxyVisaExportSelectedCustomers);
export const getIndividualRecords       = handle(proxyIndividualRecords);
export const getAiResponse              = handle(proxyAi);
