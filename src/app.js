import express from 'express';
import testRoutes from './routes/test.routes.js';

const app = express();

app.use(express.json());

app.use('/test', testRoutes);

export default app;