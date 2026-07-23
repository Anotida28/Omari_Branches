import axios from 'axios';

const BASE = 'http://172.16.3.21:3003/api/transtype';

const http = axios.create({ baseURL: BASE, timeout: 120_000 });

export async function proxyFilteredData(body: unknown) {
  const { data } = await http.post('/filtered-data', body);
  return data;
}

export async function proxyVisaMerchants(body: unknown) {
  const { data } = await http.post('/visa-merchants-enhanced', body);
  return data;
}

export async function proxyVisaCombinedStats(body: unknown) {
  const { data } = await http.post('/visa-combined-stats', body);
  return data;
}

export async function proxyVisaMerchantDetails(body: unknown) {
  const { data } = await http.post('/visa-merchant-details', body);
  return data;
}

export async function proxyVisaMerchantDetailsExport(body: unknown) {
  const { data } = await http.post('/visa-merchant-details-export', body, { timeout: 300_000 });
  return data;
}

export async function proxyVisaExportSelectedCustomers(body: unknown) {
  const { data } = await http.post('/visa-export-selected-customers', body, { timeout: 300_000 });
  return data;
}

export async function proxyIndividualRecords(body: unknown) {
  const { data } = await http.post('/individual-records', body, { timeout: 300_000 });
  return data;
}

export async function proxyAi(body: unknown) {
  const { data } = await http.post('/Ai', body, { timeout: 60_000 });
  return data;
}
