const sql = require('mssql');

const config = {
  server: '172.16.7.216',
  port: 1433,
  database: 'omari_dp',
  user: 'Devwork',
  password: 'Kick1221',
  options: {
    encrypt: true,
    trustServerCertificate: true,
    serverName: 'OMSVR-OMARI-DB',
  },
  connectionTimeout: 15000,
  requestTimeout: 300000,
};

async function run() {
  console.log('Connecting...');
  const pool = await new sql.ConnectionPool(config).connect();
  console.log('Connected. Running count...');
  const t0 = Date.now();
  const req = pool.request();
  const result = await req.query(`SELECT COUNT(*) AS n FROM omari_reporting.dbo.omzw_usd_sec_trans WITH (NOLOCK) WHERE tran_type_text='VISA Purchase Completion' AND datetime_tran_local >= DATEADD(day,-90,GETDATE())`);
  console.log('Count:', result.recordset[0].n, 'in', Date.now() - t0, 'ms');
  await pool.close();
}

run().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
