import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, isProduction } from './config/env.js';
import { connectDB } from './config/db.js';
import { requestId } from './middleware/requestId.js';
import { notFound, errorHandler } from './middleware/error.js';
import routes from './routes/index.js';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin: isProduction ? env.corsOrigins : true,
    credentials: true,
  })
);
app.use(requestId);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(routes);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(env.port, () => {
  console.log(`[server] ${env.serviceName} listening on port ${env.port} (${env.nodeEnv})`);
  console.log(`[server] asset-service expected at ${env.assetServiceUrl}`);
});

connectDB().then((conn) => {
  if (!conn) {
    console.error('[server] starting without a database connection');
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`[server] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}

export { app, server };