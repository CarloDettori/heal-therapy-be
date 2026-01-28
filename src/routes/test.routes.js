import express from 'express';
import { testInsert } from '../controllers/test.controller.js';

const router = express.Router();

router.get('/insert', testInsert);

export default router;